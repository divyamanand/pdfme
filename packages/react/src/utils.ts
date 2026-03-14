/**
 * Utility functions for @pdfme/react
 */

/**
 * Convert a PDF file to base64 format compatible with pdfme
 * @param file - PDF File object
 * @returns Promise resolving to base64 PDF data
 */
export async function convertPdfToBase64(file: File): Promise<string> {
  const { getB64BasePdf } = await import('@pdfme/common');
  const arrayBuffer = await file.arrayBuffer();
  return getB64BasePdf(new Uint8Array(arrayBuffer));
}
