import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for the TODO features in the Planning Poker server.
 *
 * The server is Node/Express, so each test starts a throwaway copy of it (own data.json,
 * random port) and calls the REST API over HTTP. Your real data.json is never touched.
 * Requires: node on the PATH, and `npm install` already run in GroupProject.
 */
class TodoApiTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Path APP_DIR = Path.of(System.getProperty("app.dir", "..")).toAbsolutePath().normalize();

    private final HttpClient http = HttpClient.newHttpClient();
    private Path tmp;
    private Process server;
    private int port;

    // ---------- setup / teardown ----------

    /** Seed data: project "demo" with a mix of tasks (see tests below for how they are used). */
    private static String seedJson() {
        String old = Instant.now().minusSeconds(300).toString();
        String now = Instant.now().toString();
        return """
        { "projects": { "demo": { "name": "Demo", "note": "",
          "users": { "stale": { "lastSeen": "%s" }, "fresh": { "lastSeen": "%s" } },
          "tasks": [
            { "id": "a", "task": "A", "note": "", "assignee": "bob",  "effort": 5,    "status": "done", "completedAt": "2026-01-01T00:00:00.000Z" },
            { "id": "b", "task": "B", "note": "", "assignee": "bob",  "effort": 3,    "status": "todo", "completedAt": null },
            { "id": "c", "task": "C", "note": "", "assignee": "alice","effort": 8,    "status": "done", "completedAt": "2026-02-01T00:00:00.000Z" },
            { "id": "d", "task": "D", "note": "", "assignee": null,   "effort": 2,    "status": "todo", "completedAt": null },
            { "id": "e", "task": "E", "note": "", "assignee": "alice","effort": null, "status": "todo", "completedAt": null },
            { "id": "v", "task": "Hidden", "note": "", "assignee": null, "votes": { "bob": 5 }, "revealed": false },
            { "id": "r", "task": "Shown",  "note": "", "assignee": null, "votes": { "bob": 8 }, "revealed": true }
          ] } } }
        """.formatted(old, now);
    }

    @BeforeEach
    void startServer() throws Exception {
        tmp = Files.createTempDirectory("pp-test");
        Files.copy(APP_DIR.resolve("server.js"), tmp.resolve("server.js"));
        Files.copy(APP_DIR.resolve("db.js"), tmp.resolve("db.js"));
        Files.copy(APP_DIR.resolve("package.json"), tmp.resolve("package.json"));
        Files.createSymbolicLink(tmp.resolve("node_modules"), APP_DIR.resolve("node_modules"));
        Files.writeString(tmp.resolve("data.json"), seedJson());

        try (ServerSocket s = new ServerSocket(0)) { port = s.getLocalPort(); }
        ProcessBuilder pb = new ProcessBuilder("node", "server.js")
                .directory(tmp.toFile())
                .redirectErrorStream(true)
                .redirectOutput(ProcessBuilder.Redirect.DISCARD);
        pb.environment().put("PORT", String.valueOf(port));
        server = pb.start();
        waitForServer();
    }

    @AfterEach
    void stopServer() throws IOException {
        if (server != null) server.destroy();
        if (tmp != null) {
            try (var paths = Files.walk(tmp)) {
                paths.sorted(java.util.Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
            }
        }
    }

    private void waitForServer() throws Exception {
        for (int i = 0; i < 100; i++) {
            try (var s = new java.net.Socket("localhost", port)) { return; }
            catch (IOException e) { Thread.sleep(100); }
        }
        fail("Node server did not start on port " + port);
    }

    // ---------- tiny HTTP helpers ----------

    private record Resp(int status, JsonNode body) {}

    private Resp call(String method, String path, String user, String jsonBody) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .header("x-project", "Demo");               // case-insensitive project login
        if (user != null) b.header("x-user", user);
        b.method(method, jsonBody == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(jsonBody));
        HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        return new Resp(r.statusCode(), JSON.readTree(r.body()));
    }

    private JsonNode task(JsonNode tasks, String id) {
        for (JsonNode t : tasks) if (id.equals(t.get("id").asText())) return t;
        return null;
    }

    private List<String> names(JsonNode arr) {
        List<String> out = new ArrayList<>();
        arr.forEach(n -> out.add(n.asText()));
        return out;
    }

    // ---------- Effort summary: GET /api/project/effort ----------

    @Test
    void effortSummary_sumsEffortPerAssignee() throws Exception {
        JsonNode rows = call("GET", "/api/project/effort", "x", null).body();
        JsonNode bob = rows.get(1);
        assertEquals("bob", bob.get("user").asText());
        assertEquals(8, bob.get("totalEffort").asInt());   // 5 + 3
        assertEquals(2, bob.get("taskCount").asInt());
        assertEquals(5, bob.get("doneEffort").asInt());    // only task A is done
    }

    @Test
    void effortSummary_skipsNullEffort_andPutsUnassignedLast() throws Exception {
        JsonNode rows = call("GET", "/api/project/effort", "x", null).body();
        // alice has E (null effort, skipped) and C (8) -> taskCount 1
        assertEquals("alice", rows.get(0).get("user").asText());
        assertEquals(1, rows.get(0).get("taskCount").asInt());
        // Unassigned row is last
        JsonNode last = rows.get(rows.size() - 1);
        assertEquals("Unassigned", last.get("user").asText());
        assertEquals(2, last.get("totalEffort").asInt());
    }

    // ---------- Completed tasks: GET /api/project/completed ----------

    @Test
    void completed_returnsOnlyDoneTasks_newestFirst() throws Exception {
        JsonNode done = call("GET", "/api/project/completed", "x", null).body();
        assertEquals(2, done.size());
        assertEquals("c", done.get(0).get("id").asText());  // 2026-02-01 is newer
        assertEquals("a", done.get(1).get("id").asText());
    }

    // ---------- Delete: DELETE /api/tasks/:id ----------

    @Test
    void deleteTask_removesIt() throws Exception {
        Resp del = call("DELETE", "/api/tasks/b", "x", null);
        assertEquals(200, del.status());
        assertEquals("b", del.body().get("id").asText());
        JsonNode tasks = call("GET", "/api/project", "x", null).body().get("tasks");
        assertNull(task(tasks, "b"));
        assertNotNull(task(tasks, "a"));   // other tasks untouched
    }

    @Test
    void deleteTask_unknownId_returns404() throws Exception {
        assertEquals(404, call("DELETE", "/api/tasks/nope", "x", null).status());
    }

    // ---------- Presence: POST /api/presence ----------

    @Test
    void presence_requiresUserName() throws Exception {
        assertEquals(400, call("POST", "/api/presence", null, null).status());
    }

    @Test
    void presence_recordsLastSeen() throws Exception {
        Resp r = call("POST", "/api/presence", "carol", null);
        assertEquals(200, r.status());
        assertDoesNotThrow(() -> Instant.parse(r.body().get("lastSeen").asText()));
    }

    @Test
    void online_listsRecentUsers_notStaleOnes_andAlwaysIncludesRequester() throws Exception {
        JsonNode online = call("GET", "/api/project", "dave", null).body().get("online");
        List<String> names = names(online);
        assertTrue(names.contains("fresh"));
        assertFalse(names.contains("stale"));      // lastSeen 5 minutes ago
        assertTrue(names.contains("dave"));        // requester always shown
    }

    @Test
    void votes_areHiddenUntilRevealed() throws Exception {
        JsonNode tasks = call("GET", "/api/project", "bob", null).body().get("tasks");
        JsonNode hidden = task(tasks, "v");
        assertFalse(hidden.has("votes"));
        assertEquals(5, hidden.get("myVote").asInt());
        assertEquals("bob", hidden.get("votedBy").get(0).asText());
        assertTrue(task(tasks, "r").has("votes"));
    }

    // ---------- Not built yet (TODOs): enable each test as you implement the feature ----------

    @Test
    @Disabled("TODO: new tasks should default effort=null, userStories, status=todo, completedAt=null")
    void createTask_hasSchemaV2Defaults() throws Exception {
        JsonNode t = call("POST", "/api/tasks", "x", "{\"task\":\"New\"}").body();
        assertTrue(t.get("effort").isNull());
        assertEquals("", t.get("userStories").asText());
        assertEquals("todo", t.get("status").asText());
        assertTrue(t.get("completedAt").isNull());
    }

    @Test
    @Disabled("TODO: PATCH should accept effort")
    void patchTask_acceptsFibonacciEffort() throws Exception {
        assertEquals(5, call("PATCH", "/api/tasks/b", "x", "{\"effort\":5}").body().get("effort").asInt());
    }

    @Test
    @Disabled("TODO: PATCH should reject invalid effort values")
    void patchTask_rejectsNonFibonacciEffort() throws Exception {
        assertEquals(400, call("PATCH", "/api/tasks/b", "x", "{\"effort\":4}").status());
    }

    @Test
    @Disabled("TODO: PATCH should accept userStories")
    void patchTask_acceptsUserStories() throws Exception {
        JsonNode t = call("PATCH", "/api/tasks/b", "x", "{\"userStories\":\"As a user...\"}").body();
        assertEquals("As a user...", t.get("userStories").asText());
    }

    @Test
    @Disabled("TODO: status=done should set completedAt")
    void patchTask_markDone_setsCompletedAt() throws Exception {
        JsonNode t = call("PATCH", "/api/tasks/b", "x", "{\"status\":\"done\"}").body();
        assertEquals("done", t.get("status").asText());
        assertDoesNotThrow(() -> Instant.parse(t.get("completedAt").asText()));
    }

    @Test
    @Disabled("TODO: status=todo (reopen) should clear completedAt")
    void patchTask_reopen_clearsCompletedAt() throws Exception {
        JsonNode t = call("PATCH", "/api/tasks/a", "x", "{\"status\":\"todo\"}").body();
        assertEquals("todo", t.get("status").asText());
        assertTrue(t.get("completedAt").isNull());
    }
}