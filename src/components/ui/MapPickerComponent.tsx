// MapPickerComponent.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";

export default function MapPickerComponent({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (coords: string) => void;
  onClose: () => void;
}) {
  const [lat, setLat] = useState<string>("24.7136");
  const [lng, setLng] = useState<string>("46.6753");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (value) {
      const parts = value.split(",");
      if (parts.length === 2) {
        const latVal = parseFloat(parts[0]);
        const lngVal = parseFloat(parts[1]);
        if (!isNaN(latVal) && !isNaN(lngVal)) {
          setLat(latVal.toString());
          setLng(lngVal.toString());
        }
      }
    }
  }, [value]);

  // Load Leaflet dynamically
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      initializeMap();
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup
      if (mapRef.current) {
        mapRef.current.remove();
      }
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  const initializeMap = () => {
    if (!mapContainerRef.current || (window as any).L === undefined) return;

    const L = (window as any).L;

    // Initialize map
    const map = L.map(mapContainerRef.current).setView(
      [parseFloat(lat), parseFloat(lng)],
      14,
    );

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Add marker
    const marker = L.marker([parseFloat(lat), parseFloat(lng)], {
      draggable: true,
    }).addTo(map);

    // Update coordinates when marker is dragged
    marker.on("dragend", (e: any) => {
      const position = marker.getLatLng();
      const newLat = position.lat.toFixed(6);
      const newLng = position.lng.toFixed(6);
      setLat(newLat);
      setLng(newLng);
    });

    // Update coordinates when map is clicked
    map.on("click", (e: any) => {
      const newLat = e.latlng.lat.toFixed(6);
      const newLng = e.latlng.lng.toFixed(6);
      setLat(newLat);
      setLng(newLng);
      marker.setLatLng([newLat, newLng]);
    });

    mapRef.current = map;
    markerRef.current = marker;
  };

  // Update map view when lat/lng change manually
  useEffect(() => {
    if (mapRef.current && (window as any).L) {
      mapRef.current.setView(
        [parseFloat(lat), parseFloat(lng)],
        mapRef.current.getZoom(),
      );
      if (markerRef.current) {
        markerRef.current.setLatLng([parseFloat(lat), parseFloat(lng)]);
      }
    }
  }, [lat, lng]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`,
      );
      const data = await response.json();
      if (data && data[0]) {
        const newLat = parseFloat(data[0].lat).toFixed(6);
        const newLng = parseFloat(data[0].lon).toFixed(6);
        setLat(newLat);
        setLng(newLng);
        if (mapRef.current) {
          mapRef.current.setView([parseFloat(newLat), parseFloat(newLng)], 15);
        }
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude.toFixed(6);
        const newLng = position.coords.longitude.toFixed(6);
        setLat(newLat);
        setLng(newLng);
        if (mapRef.current) {
          mapRef.current.setView([parseFloat(newLat), parseFloat(newLng)], 15);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert(
          "Could not get your location. Please check your browser permissions.",
        );
        setIsLoading(false);
      },
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 8,
          width: "90%",
          maxWidth: 800,
          padding: 20,
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px",
            textAlign: "right",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          🗺️ اختر الموقع من الخريطة
        </h3>

        {/* Search box */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="ابحث عن موقع (مثال: الرياض، مكة، شارع الملك فهد)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: 13,
            }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isLoading}
            style={{
              background: "#1a6fc4",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {isLoading ? "جاري البحث..." : "بحث"}
          </button>
          <button
            type="button"
            onClick={handleCurrentLocation}
            disabled={isLoading}
            style={{
              background: "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 13,
            }}
            title="استخدام موقعي الحالي"
          >
            📍 موقعي
          </button>
        </div>

        {/* Interactive Map */}
        <div
          ref={mapContainerRef}
          style={{
            height: 400,
            marginBottom: 12,
            border: "1px solid #ccc",
            borderRadius: 8,
            overflow: "hidden",
            background: "#f0f0f0",
          }}
        />

        <p
          style={{
            fontSize: 11,
            color: "#666",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          💡 انقر على الخريطة لتحديد الموقع | اسحب العلامة لضبط الإحداثيات
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: 4,
                fontSize: 12,
                color: "#666",
              }}
            >
              خط العرض (Latitude):
            </label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: 4,
                fontSize: 12,
                color: "#666",
              }}
            >
              خط الطول (Longitude):
            </label>
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#fff",
              color: "#444",
              border: "1px solid #ccc",
              borderRadius: 4,
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(`${lat},${lng}`);
              onClose();
            }}
            style={{
              background: "#1a6fc4",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            تأكيد الإحداثيات
          </button>
        </div>
      </div>
    </div>
  );
}
