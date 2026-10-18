#!/usr/bin/env node
// Generates docs/postman_collection.json (Postman v2.1). Re-run after changing endpoints:
//   node scripts/build-postman.mjs
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT_DIR } from "./python.mjs";

const json = (body) => ({
  mode: "raw",
  raw: JSON.stringify(body, null, 2),
  options: { raw: { language: "json" } },
});

const test = (...lines) => [{ listen: "test", script: { type: "text/javascript", exec: lines } }];

function request(name, method, path, { body, query, auth, events, description } = {}) {
  const [rawPath] = path.split("?");
  const item = {
    name,
    request: {
      method,
      header: body ? [{ key: "Content-Type", value: "application/json" }] : [],
      url: {
        raw: `{{baseUrl}}${path}${query ? `?${query.map((q) => `${q.key}=${q.value}`).join("&")}` : ""}`,
        host: ["{{baseUrl}}"],
        path: rawPath.split("/").filter(Boolean),
        ...(query ? { query } : {}),
      },
      ...(body ? { body: json(body) } : {}),
      ...(auth === "none"
        ? { auth: { type: "noauth" } }
        : auth // a token variable, e.g. "adminToken"
          ? { auth: { type: "bearer", bearer: [{ key: "token", value: `{{${auth}}}`, type: "string" }] } }
          : {}),
      ...(description ? { description } : {}),
    },
  };
  if (events) item.event = events;
  return item;
}

const saveToken = (variable) =>
  test(
    "pm.test('status is 2xx', () => pm.response.to.be.success);",
    "const body = pm.response.json();",
    `pm.collectionVariables.set('${variable}', body.access_token);`,
    `pm.collectionVariables.set('token', body.access_token);`,
  );

const expectStatus = (code) => test(`pm.test('status is ${code}', () => pm.response.to.have.status(${code}));`);

const collection = {
  info: {
    name: "College Review System API",
    description:
      "FastAPI + MongoDB College Review API.\n\n1. Run **Auth → Login as Admin / Teacher / Student** (tokens are stored automatically).\n2. Role-specific requests use `{{adminToken}}`, `{{teacherToken}}` or `{{studentToken}}`; the rest use `{{token}}` (the most recent login).\n3. **Create college** and **Create review** store `collegeId` / `reviewId` for the follow-up requests.\n\nSeeded accounts come from `npm run seed`.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{token}}", type: "string" }] },
  variable: [
    { key: "baseUrl", value: "http://localhost:8000/api/v1" },
    { key: "token", value: "" },
    { key: "adminToken", value: "" },
    { key: "teacherToken", value: "" },
    { key: "studentToken", value: "" },
    { key: "collegeId", value: "" },
    { key: "reviewId", value: "" },
    { key: "userId", value: "" },
  ],
  item: [
    {
      name: "Health",
      item: [request("Health check", "GET", "/health", { auth: "none", events: expectStatus(200) })],
    },
    {
      name: "Auth",
      item: [
        request("Register (student)", "POST", "/auth/register", {
          auth: "none",
          body: { name: "New Student", email: "new.student{{$timestamp}}@example.com", password: "Secret123" },
          events: test(
            "pm.test('status is 201', () => pm.response.to.have.status(201));",
            "pm.collectionVariables.set('userId', pm.response.json().user.id);",
          ),
        }),
        request("Register (teacher)", "POST", "/auth/register", {
          auth: "none",
          body: { name: "New Teacher", email: "new.teacher{{$timestamp}}@example.com", password: "Secret123", role: "teacher" },
          events: expectStatus(201),
        }),
        request("Register — validation error (422)", "POST", "/auth/register", {
          auth: "none",
          body: { name: "X", email: "not-an-email", password: "short", role: "admin" },
          events: expectStatus(422),
        }),
        request("Login as Admin", "POST", "/auth/login", {
          auth: "none",
          body: { email: "admin@collegereview.dev", password: "Admin@123" },
          events: saveToken("adminToken"),
        }),
        request("Login as Teacher", "POST", "/auth/login", {
          auth: "none",
          body: { email: "priya.teacher@collegereview.dev", password: "Password@123" },
          events: saveToken("teacherToken"),
        }),
        request("Login as Student", "POST", "/auth/login", {
          auth: "none",
          body: { email: "divya@collegereview.dev", password: "Password@123" },
          events: saveToken("studentToken"),
        }),
        request("Login — wrong password (401)", "POST", "/auth/login", {
          auth: "none",
          body: { email: "admin@collegereview.dev", password: "wrong-pass1" },
          events: expectStatus(401),
        }),
        request("Me", "GET", "/auth/me", { events: expectStatus(200) }),
      ],
    },
    {
      name: "Colleges",
      item: [
        request("List colleges (avg rating + review count)", "GET", "/colleges", {
          auth: "none",
          query: [
            { key: "page", value: "1" },
            { key: "limit", value: "10" },
            { key: "sort", value: "-rating", description: "name, -name, rating, -rating, reviews, -reviews, newest, oldest" },
          ],
          events: test(
            "pm.test('status is 200', () => pm.response.to.have.status(200));",
            "const body = pm.response.json();",
            "pm.test('has pagination meta', () => pm.expect(body.meta).to.include.keys('page','limit','total','total_pages'));",
            "pm.test('has aggregated rating fields', () => pm.expect(body.data[0]).to.include.keys('average_rating','review_count'));",
            "if (body.data.length) pm.collectionVariables.set('collegeId', body.data[0].id);",
          ),
        }),
        request("Search + filter colleges", "GET", "/colleges", {
          auth: "none",
          query: [
            { key: "search", value: "technology" },
            { key: "state", value: "tamil nadu" },
            { key: "min_rating", value: "3.5" },
          ],
          events: expectStatus(200),
        }),
        request("Create college (teacher/admin)", "POST", "/colleges", {
          body: {
            name: "Postman Test College {{$timestamp}}",
            city: "Madurai",
            state: "Tamil Nadu",
            established_year: 1995,
            website: "https://example.edu",
            courses: ["B.E.", "MBA"],
            description: "Created from the Postman collection.",
          },
          events: test(
            "pm.test('status is 201', () => pm.response.to.have.status(201));",
            "pm.collectionVariables.set('collegeId', pm.response.json().id);",
          ),
          auth: "teacherToken",
          description: "Teacher or admin only. Uses {{teacherToken}} from 'Login as Teacher'.",
        }),
        request("Get college (with rating distribution)", "GET", "/colleges/{{collegeId}}", {
          auth: "none",
          events: expectStatus(200),
        }),
        request("Update college (teacher/admin)", "PATCH", "/colleges/{{collegeId}}", {
          auth: "teacherToken",
          body: { description: "Updated description", courses: ["B.E.", "MBA", "PhD"] },
          events: expectStatus(200),
        }),
        request("Reviews of a college", "GET", "/colleges/{{collegeId}}/reviews", {
          auth: "none",
          query: [
            { key: "page", value: "1" },
            { key: "limit", value: "5" },
          ],
          events: expectStatus(200),
        }),
      ],
    },
    {
      name: "Reviews",
      item: [
        request("Create review", "POST", "/reviews", {
          auth: "studentToken",
          body: {
            college_id: "{{collegeId}}",
            rating: 4,
            title: "Good faculty and labs",
            comment: "Professors are helpful and the labs are well equipped. Hostel food is average.",
          },
          events: test(
            "pm.test('status is 201', () => pm.response.to.have.status(201));",
            "pm.collectionVariables.set('reviewId', pm.response.json().id);",
          ),
        }),
        request("Create duplicate review (409)", "POST", "/reviews", {
          auth: "studentToken",
          body: { college_id: "{{collegeId}}", rating: 5, title: "Again", comment: "Trying to review the same college twice." },
          events: expectStatus(409),
        }),
        request("List reviews (paginated)", "GET", "/reviews", {
          auth: "none",
          query: [
            { key: "page", value: "1" },
            { key: "limit", value: "10" },
            { key: "sort", value: "newest", description: "newest, oldest, rating, -rating, relevance" },
          ],
          events: expectStatus(200),
        }),
        request("Search reviews (full text)", "GET", "/reviews", {
          auth: "none",
          query: [
            { key: "search", value: "placements" },
            { key: "min_rating", value: "4" },
          ],
          events: expectStatus(200),
        }),
        request("Get review", "GET", "/reviews/{{reviewId}}", { auth: "none", events: expectStatus(200) }),
        request("Update own review", "PATCH", "/reviews/{{reviewId}}", {
          auth: "studentToken",
          body: { rating: 5, title: "Even better than I thought" },
          events: expectStatus(200),
        }),
        request("Teacher cannot delete others' review (403)", "DELETE", "/reviews/{{reviewId}}", {
          auth: "teacherToken",
          events: expectStatus(403),
        }),
        request("Delete own review", "DELETE", "/reviews/{{reviewId}}", {
          auth: "studentToken",
          events: expectStatus(204),
        }),
      ],
    },
    {
      name: "Users (admin)",
      item: [
        request("List users", "GET", "/users", {
          query: [
            { key: "role", value: "student" },
            { key: "page", value: "1" },
          ],
          events: test(
            "pm.test('status is 200', () => pm.response.to.have.status(200));",
            "const body = pm.response.json();",
            "if (body.data.length) pm.collectionVariables.set('userId', body.data[0].id);",
          ),
          auth: "adminToken",
          description: "Admin only. Uses {{adminToken}} from 'Login as Admin'.",
        }),
        request("Student cannot list users (403)", "GET", "/users", {
          auth: "studentToken",
          events: expectStatus(403),
        }),
        request("Change role / deactivate", "PATCH", "/users/{{userId}}", {
          auth: "adminToken",
          body: { role: "teacher" },
          events: expectStatus(200),
        }),
        request("Teacher cannot delete a college (403)", "DELETE", "/colleges/{{collegeId}}", {
          auth: "teacherToken",
          events: expectStatus(403),
        }),
        request("Delete college (admin, cascades reviews)", "DELETE", "/colleges/{{collegeId}}", {
          auth: "adminToken",
          events: expectStatus(204),
        }),
      ],
    },
  ],
};

const target = join(ROOT_DIR, "docs", "postman_collection.json");
writeFileSync(target, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`Wrote ${target}`);
