import { useLocalizeText } from "./LocalizedText";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { InvButton, inventoryStyles as s } from "./InventoryRecipeEditor";

export default function InventoryCamera({ onCapture, onClose }) {
  const tr = useLocalizeText();
  const video = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    let disposed = false;
    let stream;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError(
            "Camera access needs HTTPS or localhost. You can upload a photo instead.",
          );
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1600 },
          },
          audio: false,
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
      } catch (e) {
        stream?.getTracks().forEach((track) => track.stop());
        if (!disposed)
          setError(
            e.name === "NotAllowedError"
              ? "Camera access was blocked. Allow it in your browser, or upload a photo."
              : e.name === "NotFoundError"
                ? "No camera found. You can upload a photo instead."
                : "Could not open the camera. Check that it is available, or upload a photo.",
          );
      }
    })();
    return () => {
      disposed = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  async function capture() {
    if (!ready || capturing) return;
    setCapturing(true);
    try {
      const source = video.current;
      const ratio = Math.min(
        1,
        1600 / Math.max(source.videoWidth, source.videoHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(source.videoWidth * ratio);
      canvas.height = Math.round(source.videoHeight * ratio);
      canvas
        .getContext("2d")
        .drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (!blob)
        throw new Error("Photo could not be captured. Please try again.");
      onCapture({
        uri: canvas.toDataURL("image/jpeg", 0.85),
        file: blob,
        fileName: "inventory-camera.jpg",
        mimeType: "image/jpeg",
        fileSize: blob.size,
      });
    } catch (e) {
      setError(e.message);
      setCapturing(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.label}>
        {tr("Keep all bottles in view, with labels facing you")}
      </Text>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        onLoadedData={() => setReady(true)}
        style={{
          width: "100%",
          maxHeight: 380,
          objectFit: "contain",
          background: "#12251D",
          borderRadius: 12,
        }}
        aria-label={tr("Live inventory camera")}
      />
      {!ready && !error && (
        <ActivityIndicator style={{ margin: 14 }} color="#008060" />
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {tr(error)}
        </Text>
      )}
      {!error && (
        <InvButton
          icon="camera-outline"
          disabled={!ready || capturing}
          onPress={capture}
        >
          {capturing ? tr("Taking photo…") : tr("Capture & count")}
        </InvButton>
      )}
      <InvButton secondary onPress={onClose}>
        {tr("Close camera")}
      </InvButton>
    </View>
  );
}
