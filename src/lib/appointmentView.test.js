import { describe, expect, it } from "vitest";
import { toAppointmentViewModel } from "./appointmentView";

function baseRow(overrides = {}) {
  return {
    id: "appt-1",
    client_id: "client-1",
    start_time: "2026-08-02T14:30:00.000Z",
    location_address: "123 Main St",
    status: "confirmed",
    clients: { full_name: "Jane Doe" },
    appointment_services: [
      { services: { id: "svc-1", name: "Haircut" } },
      { services: { id: "svc-2", name: "Color" } },
    ],
    ...overrides,
  };
}

describe("toAppointmentViewModel", () => {
  it("maps a fully-populated row to the flat view shape", () => {
    const row = baseRow();
    const result = toAppointmentViewModel(row);
    // toLocaleTimeString renders in the test runner's local timezone --
    // compute the expected value the same way rather than hardcoding a
    // UTC-relative literal, so this test passes regardless of host TZ.
    const expectedTime = new Date(row.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

    expect(result).toEqual({
      id: "appt-1",
      clientId: "client-1",
      serviceIds: ["svc-1", "svc-2"],
      date: "2026-08-02",
      time: expectedTime,
      client: "Jane Doe",
      service: "Haircut, Color",
      location: "123 Main St",
      status: "confirmed",
      travelMinFromPrev: 0,
      distanceKmFromPrev: 0,
    });
  });

  it("extracts serviceIds in the same order as appointment_services, dropping entries with no linked service", () => {
    const row = baseRow({
      appointment_services: [
        { services: { id: "svc-1", name: "Haircut" } },
        { services: null },
        { services: { id: "svc-3", name: "Blowout" } },
      ],
    });
    const result = toAppointmentViewModel(row);

    expect(result.serviceIds).toEqual(["svc-1", "svc-3"]);
    expect(result.service).toBe("Haircut, Blowout");
  });

  it("falls back to placeholder text when the client is missing", () => {
    const row = baseRow({ clients: null });
    const result = toAppointmentViewModel(row);
    expect(result.client).toBe("Unknown client");
  });

  it("falls back to placeholder text when there are no services on the appointment", () => {
    const row = baseRow({ appointment_services: [] });
    const result = toAppointmentViewModel(row);
    expect(result.service).toBe("No service on file");
    expect(result.serviceIds).toEqual([]);
  });

  it("handles a missing appointment_services array (null/undefined) without throwing", () => {
    const row = baseRow({ appointment_services: null });
    expect(() => toAppointmentViewModel(row)).not.toThrow();
    const result = toAppointmentViewModel(row);
    expect(result.serviceIds).toEqual([]);
    expect(result.service).toBe("No service on file");
  });

  it("falls back to a dash when location_address is missing", () => {
    const row = baseRow({ location_address: null });
    const result = toAppointmentViewModel(row);
    expect(result.location).toBe("—");
  });

  it.each(["pending", "confirmed", "completed", "cancelled"])(
    "passes the status field through unchanged for status=%s (no special-casing in this mapper)",
    (status) => {
      const row = baseRow({ status });
      const result = toAppointmentViewModel(row);
      expect(result.status).toBe(status);
    }
  );

  it("derives date and time from start_time in UTC-based slicing/formatting, not local wall-clock assumptions", () => {
    const row = baseRow({ start_time: "2026-01-05T09:05:00.000Z" });
    const result = toAppointmentViewModel(row);
    expect(result.date).toBe("2026-01-05");
    // toLocaleTimeString("en-GB", { hour12: false }) on a Date renders in the
    // host machine's local timezone -- assert the *shape*, not a specific
    // wall-clock value, so this test doesn't depend on the CI runner's TZ.
    expect(result.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it("does not mutate the input row object", () => {
    const row = baseRow();
    const snapshotBefore = JSON.parse(JSON.stringify(row));
    toAppointmentViewModel(row);
    expect(row).toEqual(snapshotBefore);
  });

  it("does not mutate nested appointment_services entries", () => {
    const row = baseRow();
    const servicesSnapshot = JSON.parse(JSON.stringify(row.appointment_services));
    toAppointmentViewModel(row);
    expect(row.appointment_services).toEqual(servicesSnapshot);
  });
});
