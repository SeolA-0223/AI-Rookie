import { requestGeminiJsonWithParts } from "../ai/geminiJson.js";
import { SourceResolutionError } from "../sources/lawSource.js";
import { getMunicipalityNames, normalizeMunicipalityCodes } from "../sources/providers/lawGoMunicipalities.js";

export const SUPPORTED_DOCUMENT_MEDIA_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDocumentText(value) {
  return normalizeText(value).replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function estimateBase64Bytes(value) {
  const normalized = normalizeText(value).replace(/\s+/g, "");
  if (!normalized) {
    return 0;
  }

  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function inferMediaKind(mimeType) {
  return mimeType === "application/pdf" ? "pdf" : "image";
}

function buildMediaExtractionError(message, details = [], statusCode = 502) {
  return new SourceResolutionError({
    code: "SOURCE_FETCH_FAILED",
    message,
    details,
    statusCode
  });
}

function normalizeDocumentMedia(documentMedia = {}) {
  const source = documentMedia && typeof documentMedia === "object" ? documentMedia : {};
  const mimeType = normalizeText(source.mimeType).toLowerCase();
  const data = normalizeText(source.data).replace(/\s+/g, "");
  const originalFileName = normalizeText(source.originalFileName);

  if (!mimeType || !SUPPORTED_DOCUMENT_MEDIA_MIME_TYPES.has(mimeType) || !data) {
    return null;
  }

  return {
    mimeType,
    data,
    originalFileName,
    kind: inferMediaKind(mimeType),
    byteSize: estimateBase64Bytes(data)
  };
}

function buildMediaExtractionPrompt({ fileName, mimeType, municipalityNames = [] }) {
  return [
    "You read a Korean municipal public notice, flyer, image, or PDF and convert it into clean text for ordinance review.",
    "Return JSON only with these keys:",
    "extractedDocumentText, apparentTitle, cleanedSummary, documentType, ordinanceKeywords, municipalityMentions, reasoning",
    "Requirements:",
    "- Read the visible Korean text from the file accurately.",
    "- Put the best reconstructed readable text into extractedDocumentText.",
    "- Keep the headline or document title at the top of extractedDocumentText when visible.",
    "- Normalize poster-like or flyer layouts into readable sentences and paragraphs.",
    "- cleanedSummary must be a short Korean summary of the document's purpose.",
    "- ordinanceKeywords must be a short array of Korean search keywords helpful for ordinance lookup.",
    "- municipalityMentions must be an array of Korean municipality names seen in or strongly implied by the file.",
    "- Do not invent facts that are not visible in the file.",
    "",
    `Uploaded file name: ${fileName || "unknown"}`,
    `Uploaded MIME type: ${mimeType}`,
    `Requested municipality hints: ${JSON.stringify(municipalityNames)}`,
    "",
    "If the file is a PDF, read each page and merge the relevant text into one coherent Korean document."
  ].join("\n");
}

export async function extractDocumentTextFromMedia(
  {
    documentMedia,
    fileName = "",
    municipalities = []
  },
  {
    env = process.env,
    fetchImpl = globalThis.fetch
  } = {}
) {
  const normalizedMedia = normalizeDocumentMedia(documentMedia);
  if (!normalizedMedia) {
    return null;
  }

  const municipalityNames = getMunicipalityNames(normalizeMunicipalityCodes(municipalities));
  const prompt = buildMediaExtractionPrompt({
    fileName: normalizedMedia.originalFileName || fileName,
    mimeType: normalizedMedia.mimeType,
    municipalityNames
  });
  const aiResult = await requestGeminiJsonWithParts(
    [
      {
        text: prompt
      },
      {
        inline_data: {
          mime_type: normalizedMedia.mimeType,
          data: normalizedMedia.data
        }
      }
    ],
    {
      env,
      fetchImpl,
      temperature: 0.1
    }
  );

  if (!aiResult.ok || !aiResult.value || typeof aiResult.value !== "object") {
    throw buildMediaExtractionError(
      "Failed to read the uploaded image/PDF with Gemini.",
      aiResult.meta?.error ? [{ path: "media", message: aiResult.meta.error }] : []
    );
  }

  const payload = aiResult.value;
  const extractedDocumentText = cleanDocumentText(payload.extractedDocumentText);
  if (!extractedDocumentText) {
    throw buildMediaExtractionError("Gemini could not extract readable text from the uploaded image/PDF.");
  }

  return {
    kind: normalizedMedia.kind,
    mimeType: normalizedMedia.mimeType,
    byteSize: normalizedMedia.byteSize,
    fileName: normalizedMedia.originalFileName || fileName,
    apparentTitle: normalizeText(payload.apparentTitle),
    cleanedSummary: normalizeText(payload.cleanedSummary),
    documentType: normalizeText(payload.documentType),
    ordinanceKeywords: unique(
      Array.isArray(payload.ordinanceKeywords) ? payload.ordinanceKeywords.map(normalizeText) : []
    ).slice(0, 8),
    municipalityMentions: unique(
      Array.isArray(payload.municipalityMentions) ? payload.municipalityMentions.map(normalizeText) : []
    ),
    reasoning: normalizeText(payload.reasoning),
    documentText: extractedDocumentText,
    ai: aiResult.meta
  };
}
