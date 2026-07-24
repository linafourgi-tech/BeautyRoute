import React from "react";
import { EditorialImage } from "../media/EditorialImage.jsx";
export function BeforeAfterGallery({ before, after, date, service, tone = "rose" }) {
  return React.createElement("div", { style: { fontFamily: "var(--font-body)" } },
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
      React.createElement("div", null,
        React.createElement(EditorialImage, { src: before, tone: "sand", label: "", ratio: "4 / 5", overlay: React.createElement("span", { style: { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" } }, "Before") })),
      React.createElement("div", null,
        React.createElement(EditorialImage, { src: after, tone: tone, label: "", ratio: "4 / 5", overlay: React.createElement("span", { style: { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" } }, "After") }))),
    (date || service) && React.createElement("div", { style: { fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 } }, service, date && " · " + date)
  );
}
