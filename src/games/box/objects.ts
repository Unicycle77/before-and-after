import closedBox from "../../assets/box/box-closed.svg";
import openBox from "../../assets/box/box-open.svg";

/** The decorative box, closed and (empty) open. */
export const BOX_ART = { closed: closedBox, open: openBox };

export interface BoxObject { id: string; name: string; url: string }

/*
 * The things that can go in the box: every picture in src/assets/box-objects. The file name is the
 * object ("carrot.jpg" → Carrot, "rubber-duck.png" → Rubber duck). If a photo and a drawing share a
 * name (carrot.jpg and carrot.svg), the photo is used.
 */
const files = import.meta.glob("../../assets/box-objects/*.{png,jpg,jpeg,webp,gif,svg}", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

const byId = new Map<string, BoxObject>();
for (const [path, url] of Object.entries(files)) {
  const file = path.split("/").pop()!;
  const id = file.replace(/\.[^.]+$/, "").toLowerCase();
  const words = id.replace(/[-_]+/g, " ").trim();
  const isDrawing = file.toLowerCase().endsWith(".svg");
  if (byId.has(id) && isDrawing) continue;
  byId.set(id, { id, name: words.charAt(0).toUpperCase() + words.slice(1), url });
}

export const OBJECTS: BoxObject[] = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

export const findObject = (id: string | undefined): BoxObject | undefined => OBJECTS.find((o) => o.id === id);
