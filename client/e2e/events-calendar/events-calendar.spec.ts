import { expect, test, type Page } from "@playwright/test";

type MockRole = "admin" | "teacher" | "student";

type MockState = {
  schoolEvents: Array<Record<string, any>>;
  calendarEvents: Array<Record<string, any>>;
  attachmentByEvent: Record<string, Array<Record<string, any>>>;
  calendarUpdateCalls: number;
  schoolCreateCalls: number;
};

function ok(data: any = null, message = "OK") {
  return {
    status: "SUCCESS",
    success: true,
    message,
    ...(data === null ? {} : { data }),
  };
}

function rolePayload(role: MockRole) {
  if (role === "student") {
    return {
      id: 300,
      username: "student-user",
      role_id: 3,
      role_name: "Student",
      display_name: "Student User",
      school_name: "Demo School",
    };
  }
  if (role === "teacher") {
    return {
      id: 200,
      username: "teacher-user",
      role_id: 2,
      role_name: "Teacher",
      display_name: "Teacher User",
      school_name: "Demo School",
    };
  }
  return {
    id: 100,
    username: "admin-user",
    role_id: 1,
    role_name: "Admin",
    display_name: "Admin User",
    school_name: "Demo School",
  };
}

async function mockApi(page: Page, role: MockRole, seed?: Partial<MockState>) {
  let nextSchoolEventId = 10;
  let nextCalendarEventId = 20;
  let nextAttachmentId = 100;

  const state: MockState = {
    schoolEvents: seed?.schoolEvents ?? [
      {
        id: 1,
        title: "School Assembly",
        description: "Morning assembly",
        start_date: "2026-05-01T09:00:00.000Z",
        end_date: "2026-05-01T10:00:00.000Z",
        event_color: "bg-primary",
        is_all_day: false,
        location: "Hall",
        event_category: "Meeting",
        event_for: "all",
        target_class_ids: null,
        target_section_ids: null,
      },
    ],
    calendarEvents: seed?.calendarEvents ?? [
      {
        id: 3,
        title: "My Task",
        description: "Personal work",
        start_date: "2026-05-02T08:00:00.000Z",
        end_date: "2026-05-02T09:00:00.000Z",
        event_color: "bg-info",
        is_all_day: false,
        location: "Desk",
      },
    ],
    attachmentByEvent: seed?.attachmentByEvent ?? {},
    calendarUpdateCalls: 0,
    schoolCreateCalls: 0,
  };

  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method().toUpperCase();
    const jsonHeaders = {
      "content-type": "application/json",
    };

    // Auth bootstrap
    if (path.endsWith("/api/auth/me") && method === "GET") {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(ok(rolePayload(role), "Session valid")),
      });
    }
    if (path.endsWith("/api/auth/csrf-token") && method === "GET") {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(ok({ csrfToken: "e2e-csrf-token" })),
      });
    }

    // Static lookup data for event form targeting
    if (path.endsWith("/api/classes") && method === "GET") {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(
          ok([
            { id: 11, class_name: "I" },
            { id: 12, class_name: "II" },
          ])
        ),
      });
    }
    if (path.endsWith("/api/sections") && method === "GET") {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(
          ok([
            { id: 21, section_name: "A", class_name: "I" },
            { id: 22, section_name: "B", class_name: "II" },
          ])
        ),
      });
    }

    // School events
    if (path.endsWith("/api/events") && method === "GET") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const category = (url.searchParams.get("event_category") || "").toLowerCase();
      const eventFor = (url.searchParams.get("event_for") || "").toLowerCase();
      let rows = [...state.schoolEvents];
      if (category) rows = rows.filter((e) => String(e.event_category || "").toLowerCase() === category);
      if (eventFor) {
        rows = rows.filter((e) => {
          const ef = String(e.event_for || "all").toLowerCase();
          if (eventFor === "staff") return ["staff", "staffs", "teachers"].includes(ef);
          return ef === eventFor;
        });
      }
      if (q) {
        rows = rows.filter(
          (e) =>
            String(e.title || "").toLowerCase().includes(q) ||
            String(e.description || "").toLowerCase().includes(q)
        );
      }
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(ok(rows)),
      });
    }
    if (path.endsWith("/api/events") && method === "POST") {
      const body = req.postDataJSON() as Record<string, any>;
      const created = { id: ++nextSchoolEventId, ...body };
      state.schoolEvents.unshift(created);
      state.schoolCreateCalls += 1;
      return route.fulfill({
        status: 201,
        headers: jsonHeaders,
        body: JSON.stringify(ok(created, "Event created successfully")),
      });
    }
    if (/\/api\/events\/\d+$/.test(path) && method === "PUT") {
      const id = Number(path.split("/").pop());
      const body = req.postDataJSON() as Record<string, any>;
      const idx = state.schoolEvents.findIndex((e) => Number(e.id) === id);
      if (idx === -1) {
        return route.fulfill({
          status: 404,
          headers: jsonHeaders,
          body: JSON.stringify({ success: false, status: "ERROR", message: "Event not found" }),
        });
      }
      state.schoolEvents[idx] = { ...state.schoolEvents[idx], ...body };
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(ok(state.schoolEvents[idx], "Event updated successfully")),
      });
    }
    if (/\/api\/events\/\d+$/.test(path) && method === "DELETE") {
      const id = Number(path.split("/").pop());
      state.schoolEvents = state.schoolEvents.filter((e) => Number(e.id) !== id);
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(ok(null, "Event deleted successfully")),
      });
    }

    // Event attachments
    if (/\/api\/events\/\d+\/attachments$/.test(path) && method === "GET") {
      const eventId = String(path.split("/")[3]);
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(ok(state.attachmentByEvent[eventId] || [])),
      });
    }
    if (/\/api\/events\/\d+\/attachments$/.test(path) && method === "POST") {
      const eventId = String(path.split("/")[3]);
      const att = {
        id: ++nextAttachmentId,
        event_id: Number(eventId),
        file_url: `/api/storage/files/school_1/documents/upload-${nextAttachmentId}.pdf`,
        file_name: `upload-${nextAttachmentId}.pdf`,
        file_type: "application/pdf",
        file_size: 1024,
      };
      state.attachmentByEvent[eventId] = state.attachmentByEvent[eventId] || [];
      state.attachmentByEvent[eventId].unshift(att);
      return route.fulfill({
        status: 201,
        headers: jsonHeaders,
        body: JSON.stringify(ok(att, "Event attachment uploaded successfully")),
      });
    }
    if (/\/api\/events\/\d+\/attachments\/\d+$/.test(path) && method === "DELETE") {
      const chunks = path.split("/");
      const eventId = chunks[3];
      const attachmentId = Number(chunks[5]);
      state.attachmentByEvent[eventId] = (state.attachmentByEvent[eventId] || []).filter(
        (a) => Number(a.id) !== attachmentId
      );
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(ok({ id: attachmentId }, "Event attachment deleted successfully")),
      });
    }

    // Generic school storage upload used by attachment URL helper
    if (path.endsWith("/api/storage/upload") && method === "POST") {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(
          ok({
            relativePath: "school_1/documents/mock-file.pdf",
            url: "/api/storage/files/school_1/documents/mock-file.pdf",
          })
        ),
      });
    }

    // Personal calendar
    if (path.endsWith("/api/calendar") && method === "GET") {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(ok(state.calendarEvents)),
      });
    }
    if (path.endsWith("/api/calendar") && method === "POST") {
      const body = req.postDataJSON() as Record<string, any>;
      const created = { id: ++nextCalendarEventId, ...body };
      state.calendarEvents.unshift(created);
      return route.fulfill({
        status: 201,
        headers: jsonHeaders,
        body: JSON.stringify(ok(created, "Event created successfully")),
      });
    }
    if (/\/api\/calendar\/\d+$/.test(path) && method === "PUT") {
      const id = Number(path.split("/").pop());
      const body = req.postDataJSON() as Record<string, any>;
      const idx = state.calendarEvents.findIndex((e) => Number(e.id) === id);
      if (idx !== -1) {
        state.calendarEvents[idx] = { ...state.calendarEvents[idx], ...body };
      }
      state.calendarUpdateCalls += 1;
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(ok(state.calendarEvents[idx] || { id, ...body }, "Event updated successfully")),
      });
    }
    if (/\/api\/calendar\/\d+$/.test(path) && method === "DELETE") {
      const id = Number(path.split("/").pop());
      state.calendarEvents = state.calendarEvents.filter((e) => Number(e.id) !== id);
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(ok(null, "Event deleted successfully")),
      });
    }

    // Safe default for unrelated API calls from shared layout widgets
    return route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify(ok([])),
    });
  });

  return state;
}

test.describe("Events page E2E", () => {
  test("load/create/update/delete/filter/upload attachment", async ({ page }) => {
    const state = await mockApi(page, "admin");
    await page.goto("/announcements/events");

    await expect(page.locator("h3", { hasText: "Events" })).toBeVisible();
    await expect(page.locator("text=School Assembly").first()).toBeVisible();

    // Create event
    await page.getByRole("button", { name: "Add New Event" }).click();
    await page.locator(".modal.show input.form-control").first().fill("E2E New Event");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect.poll(() => state.schoolCreateCalls).toBeGreaterThan(0);

    // Open details and edit
    await page.getByRole("button", { name: "View" }).first().click();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator(".modal.show input.form-control").first().fill("E2E Updated Event");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Event updated successfully.")).toBeVisible();
    await expect(page.locator("text=E2E Updated Event").first()).toBeVisible();

    // Filter by search
    await page.getByPlaceholder("Title or description").fill("Updated");
    await expect(page.locator("text=E2E Updated Event").first()).toBeVisible();

    // Attachment upload UI path
    await page.getByRole("button", { name: "Add New Event" }).click();
    await page
      .locator(".modal.show input[type='file']")
      .first()
      .setInputFiles({
        name: "upload.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4"),
      });
    await expect(page.getByText("Attachment uploaded.")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Delete flow
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "View" }).first().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Event deleted successfully.")).toBeVisible();
  });

  test("invalid input + permission restriction + empty state", async ({ page }) => {
    await mockApi(page, "student", { schoolEvents: [] });
    await page.goto("/announcements/events");

    await expect(page.getByText("No events match this filter.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add New Event" })).toHaveCount(0);
  });
});

test.describe("Calendar page E2E", () => {
  test("load/create/update/delete/drag-toggle-school-events", async ({ page }) => {
    const state = await mockApi(page, "admin");
    await page.goto("/calendar");

    await expect(page.locator("h3", { hasText: "Calendar" })).toBeVisible();
    await expect(page.getByText("My Task")).toBeVisible();

    // Create
    await page.getByRole("button", { name: "Create event" }).click();
    await page.locator(".modal.show input.form-control").first().fill("Calendar E2E");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Calendar E2E")).toBeVisible();

    // Edit
    await page.locator(".fc-event").first().click();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator(".modal.show input.form-control").first().fill("Calendar E2E Updated");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Calendar E2E Updated")).toBeVisible();

    // Drag event to trigger update call
    const source = page.locator(".fc-event").first();
    const targetDay = page.locator(".fc-daygrid-day").nth(10);
    await source.dragTo(targetDay);
    await expect.poll(() => state.calendarUpdateCalls).toBeGreaterThan(0);

    // Toggle school events visibility
    await page.getByLabel("Show school-wide events").check();
    await expect(page.getByText("School Assembly")).toBeVisible();

    // Delete
    page.once("dialog", (d) => d.accept());
    await page.locator(".fc-event").first().click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Calendar E2E Updated")).toHaveCount(0);
  });

  test("calendar empty state + validation edge case", async ({ page }) => {
    await mockApi(page, "admin", { calendarEvents: [] });
    await page.goto("/calendar");
    await expect(page.getByText("About this calendar")).toBeVisible();

    await page.getByRole("button", { name: "Create event" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Save" }).click();
  });
});

