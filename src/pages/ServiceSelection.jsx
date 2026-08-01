import React from "react";
import { useNavigate } from "react-router-dom";

export default function ServiceSelection() {
  const navigate = useNavigate();

  const services = [
    { id: "hair", name: "Hair", icon: "💇", status: "active", subtitle: "Enter HairRoute Ecosystem" },
    { id: "makeup", name: "Makeup", icon: "💄", status: "coming-soon", subtitle: "MakeupRoute coming soon" },
    { id: "nails", name: "Nails", icon: "💅", status: "coming-soon", subtitle: "NailRoute coming soon" },
    { id: "spa", name: "Spa", icon: "🧖", status: "coming-soon", subtitle: "SpaRoute coming soon" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#121212",
      color: "#ffffff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "20px"
    }}>
      <header style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "2.5rem", color: "#d4af37", marginBottom: "10px", fontWeight: "700" }}>
          BeautyRoute Platform
        </h1>
        <p style={{ color: "#aaa", fontSize: "1.1rem" }}>Welcome back! Select an active ecosystem module to manage</p>
      </header>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "20px",
        width: "100%",
        maxWidth: "960px"
      }}>
        {services.map((service) => {
          const isActive = service.status === "active";
          return (
            <div
              key={service.id}
              onClick={() => isActive && navigate("/services")}
              style={{
                backgroundColor: "#1e1e1e",
                borderRadius: "12px",
                padding: "30px 20px",
                textAlign: "center",
                border: isActive ? "2px solid #d4af37" : "1px solid #333",
                cursor: isActive ? "pointer" : "not-allowed",
                opacity: isActive ? 1 : 0.6,
                transition: "all 0.2s ease-in-out",
                transform: "scale(1)"
              }}
              onMouseEnter={(e) => isActive && (e.currentTarget.style.transform = "scale(1.03)")}
              onMouseLeave={(e) => isActive && (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{ fontSize: "3.5rem", marginBottom: "15px" }}>{service.icon}</div>
              <h3 style={{ fontSize: "1.4rem", marginBottom: "8px", color: isActive ? "#fff" : "#888" }}>
                {service.name}
              </h3>
              <p style={{ fontSize: "0.9rem", color: isActive ? "#d4af37" : "#666", margin: 0 }}>
                {isActive ? service.subtitle : "🔒 Coming Soon"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}