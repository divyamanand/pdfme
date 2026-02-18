import React, { useState, useCallback } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Link, Unlink, Settings } from "lucide-react";
import { cloneDeep, isBlankPdf } from "@pdfme/common";
import { toast } from "react-toastify";
import { Designer } from "@pdfme/ui";

const PAGE_PRESETS = [
  { label: "A4", width: 210, height: 297 },
  { label: "A3", width: 297, height: 420 },
  { label: "A5", width: 148, height: 210 },
  { label: "Letter", width: 215.9, height: 279.4 },
  { label: "Legal", width: 215.9, height: 355.6 },
  { label: "Custom", width: 0, height: 0 },
] as const;

type Padding = [number, number, number, number];

function detectPreset(w: number, h: number): string {
  for (const p of PAGE_PRESETS) {
    if (p.label === "Custom") continue;
    if (
      (Math.abs(w - p.width) < 0.5 && Math.abs(h - p.height) < 0.5) ||
      (Math.abs(w - p.height) < 0.5 && Math.abs(h - p.width) < 0.5)
    ) {
      return p.label;
    }
  }
  return "Custom";
}

function isPortrait(w: number, h: number): boolean {
  return h >= w;
}

type Props = {
  disabled: boolean;
  designer: React.RefObject<Designer | null>;
};

export function PageSettings({ disabled, designer }: Props) {
  const [selectedPreset, setSelectedPreset] = useState("A4");
  const [width, setWidth] = useState(210);
  const [height, setHeight] = useState(297);
  const [padding, setPadding] = useState<Padding>([20, 10, 20, 10]);
  const [paddingLinked, setPaddingLinked] = useState(false);
  const [isCustomPdf, setIsCustomPdf] = useState(false);

  const syncFromDesigner = useCallback(() => {
    if (!designer.current) return;
    const template = designer.current.getTemplate();
    if (!isBlankPdf(template.basePdf)) {
      setIsCustomPdf(true);
      return;
    }
    setIsCustomPdf(false);
    const bp = template.basePdf;
    setWidth(bp.width);
    setHeight(bp.height);
    setPadding([...bp.padding]);
    setSelectedPreset(detectPreset(bp.width, bp.height));
  }, [designer]);

  const clampSchemas = useCallback(
    (template: ReturnType<Designer["getTemplate"]>, newWidth: number, newHeight: number): boolean => {
      let clamped = false;
      const minVisible = 5;

      const clampArray = (schemas: Array<{ position: { x: number; y: number } }>) => {
        for (const s of schemas) {
          const maxX = newWidth - minVisible;
          const maxY = newHeight - minVisible;
          if (s.position.x > maxX) {
            s.position.x = Math.max(0, maxX);
            clamped = true;
          }
          if (s.position.y > maxY) {
            s.position.y = Math.max(0, maxY);
            clamped = true;
          }
        }
      };

      for (const page of template.schemas) {
        clampArray(page as Array<{ position: { x: number; y: number } }>);
      }

      if (isBlankPdf(template.basePdf) && template.basePdf.staticSchema) {
        clampArray(template.basePdf.staticSchema as Array<{ position: { x: number; y: number } }>);
      }

      return clamped;
    },
    []
  );

  const applyPageSettings = useCallback(
    (newWidth: number, newHeight: number, newPadding: Padding) => {
      if (!designer.current) return;
      if (newWidth < 50 || newHeight < 50) return;
      if (newPadding[0] + newPadding[2] >= newHeight) return;
      if (newPadding[1] + newPadding[3] >= newWidth) return;

      const template = cloneDeep(designer.current.getTemplate());
      if (!isBlankPdf(template.basePdf)) return;

      const clamped = clampSchemas(template, newWidth, newHeight);

      template.basePdf = {
        ...template.basePdf,
        width: newWidth,
        height: newHeight,
        padding: newPadding,
      };

      designer.current.updateTemplate(template);

      if (clamped) {
        toast.warning("Some fields were repositioned to stay within the new page bounds.");
      }
    },
    [designer, clampSchemas]
  );

  const isValidDimension = (v: number) => v >= 50 && v <= 1000;
  const isValidPadding = (p: Padding, w: number, h: number) =>
    p[0] >= 0 && p[1] >= 0 && p[2] >= 0 && p[3] >= 0 &&
    p[0] + p[2] < h && p[1] + p[3] < w;

  const handlePresetChange = (label: string) => {
    setSelectedPreset(label);
    const preset = PAGE_PRESETS.find((p) => p.label === label);
    if (!preset || label === "Custom") return;

    const portrait = isPortrait(width, height);
    const newW = portrait ? Math.min(preset.width, preset.height) : Math.max(preset.width, preset.height);
    const newH = portrait ? Math.max(preset.width, preset.height) : Math.min(preset.width, preset.height);
    setWidth(newW);
    setHeight(newH);
    applyPageSettings(newW, newH, padding);
  };

  const handleOrientationToggle = (portrait: boolean) => {
    const currentPortrait = isPortrait(width, height);
    if (currentPortrait === portrait) return;
    const newW = height;
    const newH = width;
    setWidth(newW);
    setHeight(newH);
    applyPageSettings(newW, newH, padding);
  };

  const handleDimensionBlur = (dim: "width" | "height", value: number) => {
    if (!isValidDimension(value)) return;
    const newW = dim === "width" ? value : width;
    const newH = dim === "height" ? value : height;
    setSelectedPreset(detectPreset(newW, newH));
    applyPageSettings(newW, newH, padding);
  };

  const handleDimensionKeyDown = (e: React.KeyboardEvent, dim: "width" | "height", value: number) => {
    if (e.key === "Enter") {
      handleDimensionBlur(dim, value);
    }
  };

  const handlePaddingChange = (index: number, value: number) => {
    if (value < 0 || value > 100) return;
    const newPadding: Padding = [...padding];
    if (paddingLinked) {
      newPadding[0] = value;
      newPadding[1] = value;
      newPadding[2] = value;
      newPadding[3] = value;
    } else {
      newPadding[index] = value;
    }
    setPadding(newPadding);
  };

  const handlePaddingBlur = () => {
    if (isValidPadding(padding, width, height)) {
      applyPageSettings(width, height, padding);
    }
  };

  const handlePaddingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handlePaddingBlur();
    }
  };

  const isCustom = selectedPreset === "Custom";
  const portrait = isPortrait(width, height);

  return (
    <Popover className="relative">
      <PopoverButton
        disabled={disabled}
        onClick={syncFromDesigner}
        className="flex items-center gap-1 px-2 py-1 border rounded hover:bg-gray-100 w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Settings className="w-3.5 h-3.5" />
        Page
      </PopoverButton>

      <PopoverPanel
        anchor="bottom start"
        className="z-50 mt-1 w-72 bg-white border rounded-lg shadow-lg p-3 text-sm"
      >
        {isCustomPdf ? (
          <p className="text-gray-500 text-xs py-2">
            Page settings are only available for blank PDF templates.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Size Preset + Orientation */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Size</label>
                <select
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                >
                  {PAGE_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-0.5">
                <button
                  className={`px-2 py-1 border rounded-l text-xs font-medium transition-colors ${
                    portrait
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white hover:bg-gray-100"
                  }`}
                  onClick={() => handleOrientationToggle(true)}
                  title="Portrait"
                >
                  Portrait
                </button>
                <button
                  className={`px-2 py-1 border rounded-r text-xs font-medium transition-colors ${
                    !portrait
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white hover:bg-gray-100"
                  }`}
                  onClick={() => handleOrientationToggle(false)}
                  title="Landscape"
                >
                  Landscape
                </button>
              </div>
            </div>

            {/* Width + Height */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Width (mm)</label>
                <input
                  type="number"
                  min={50}
                  max={1000}
                  step={0.1}
                  disabled={!isCustom}
                  className={`w-full border rounded px-2 py-1 text-sm ${
                    !isCustom ? "bg-gray-50 text-gray-400" : ""
                  } ${!isValidDimension(width) ? "border-red-400" : ""}`}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  onBlur={() => handleDimensionBlur("width", width)}
                  onKeyDown={(e) => handleDimensionKeyDown(e, "width", width)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Height (mm)</label>
                <input
                  type="number"
                  min={50}
                  max={1000}
                  step={0.1}
                  disabled={!isCustom}
                  className={`w-full border rounded px-2 py-1 text-sm ${
                    !isCustom ? "bg-gray-50 text-gray-400" : ""
                  } ${!isValidDimension(height) ? "border-red-400" : ""}`}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  onBlur={() => handleDimensionBlur("height", height)}
                  onKeyDown={(e) => handleDimensionKeyDown(e, "height", height)}
                />
              </div>
            </div>

            {/* Padding */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Padding (mm)</label>
                <button
                  className="p-0.5 rounded hover:bg-gray-100 text-gray-500"
                  onClick={() => setPaddingLinked(!paddingLinked)}
                  title={paddingLinked ? "Unlink padding values" : "Link padding values"}
                >
                  {paddingLinked ? (
                    <Link className="w-3.5 h-3.5" />
                  ) : (
                    <Unlink className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["Top", "Right", "Bottom", "Left"] as const).map((label, i) => (
                  <div key={label}>
                    <label className="block text-xs text-gray-400 mb-0.5">{label}</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      className={`w-full border rounded px-2 py-1 text-sm ${
                        !isValidPadding(padding, width, height) ? "border-red-400" : ""
                      }`}
                      value={padding[i]}
                      onChange={(e) => handlePaddingChange(i, Number(e.target.value))}
                      onBlur={handlePaddingBlur}
                      onKeyDown={handlePaddingKeyDown}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </PopoverPanel>
    </Popover>
  );
}
