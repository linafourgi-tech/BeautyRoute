import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { createFile, deleteFile, getFilesForEntity } from "./files";

const WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
const ENTITY_ID = "22222222-2222-2222-2222-222222222222";
const FILE_ID = "33333333-3333-3333-3333-333333333333";

function buildInsertChain(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { insert, select, single };
}

describe("createFile", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("inserts a file with a valid http(s) file_url -- unchanged behavior for a real before/after photo URL", async () => {
    const chain = buildInsertChain({ data: { id: FILE_ID }, error: null });
    fromMock.mockReturnValue({ insert: chain.insert });

    const file = {
      workspace_id: WORKSPACE_ID,
      entity_type: "visit",
      entity_id: ENTITY_ID,
      file_url: "https://example.com/before.jpg",
      file_type: "image",
      file_purpose: "before",
    };
    await createFile(file);
    expect(chain.insert).toHaveBeenCalledWith(file);
  });

  it("REGRESSION: rejects a non-URL file_url instead of silently persisting it", async () => {
    await expect(
      createFile({
        workspace_id: WORKSPACE_ID,
        entity_type: "visit",
        entity_id: ENTITY_ID,
        file_url: "not-a-real-url",
        file_type: "image",
        file_purpose: "before",
      })
    ).rejects.toThrow("file_url must be a valid http(s) URL.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("REGRESSION: rejects a javascript: URL", async () => {
    await expect(
      createFile({
        workspace_id: WORKSPACE_ID,
        entity_type: "visit",
        entity_id: ENTITY_ID,
        file_url: "javascript:alert(1)",
        file_type: "image",
        file_purpose: "before",
      })
    ).rejects.toThrow("file_url must be a valid http(s) URL.");
  });

  it("rejects a non-UUID workspace_id", async () => {
    await expect(
      createFile({
        workspace_id: "not-a-uuid",
        entity_type: "visit",
        entity_id: ENTITY_ID,
        file_url: "https://example.com/before.jpg",
        file_type: "image",
        file_purpose: "before",
      })
    ).rejects.toThrow("Workspace id must be a valid id.");
  });

  it("rejects a non-UUID entity_id", async () => {
    await expect(
      createFile({
        workspace_id: WORKSPACE_ID,
        entity_type: "visit",
        entity_id: "not-a-uuid",
        file_url: "https://example.com/before.jpg",
        file_type: "image",
        file_purpose: "before",
      })
    ).rejects.toThrow("Entity id must be a valid id.");
  });
});

describe("getFilesForEntity", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("rejects a non-UUID entity id before querying", async () => {
    await expect(getFilesForEntity("visit", "not-a-uuid")).rejects.toThrow("Entity id must be a valid id.");
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("deleteFile", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("rejects a non-UUID id before deleting", async () => {
    await expect(deleteFile("not-a-uuid")).rejects.toThrow("File id must be a valid id.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("deletes by a valid id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ delete: del });

    await deleteFile(FILE_ID);
    expect(eq).toHaveBeenCalledWith("id", FILE_ID);
  });
});
