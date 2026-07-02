// Minimal Thai OCR for gazette PDFs using Apple's Vision framework.
// Usage: ocr <file.pdf> [maxPages]   — prints recognized text to stdout.
// Needed because most section ก gazette PDFs have broken font encodings
// that make embedded-text extraction unusable.
import Foundation
import PDFKit
import Vision

let args = CommandLine.arguments
guard args.count >= 2 else {
    FileHandle.standardError.write("usage: ocr <pdf> [maxPages]\n".data(using: .utf8)!)
    exit(1)
}
let url = URL(fileURLWithPath: args[1])
let maxPages = args.count > 2 ? (Int(args[2]) ?? 1) : 1
guard let doc = PDFDocument(url: url) else {
    FileHandle.standardError.write("cannot open pdf\n".data(using: .utf8)!)
    exit(2)
}

for i in 0..<min(maxPages, doc.pageCount) {
    guard let page = doc.page(at: i) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2.5
    let w = Int(bounds.width * scale), h = Int(bounds.height * scale)
    guard let ctx = CGContext(
        data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { continue }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)
    guard let img = ctx.makeImage() else { continue }

    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["th-TH", "en-US"]
    req.usesLanguageCorrection = true
    let handler = VNImageRequestHandler(cgImage: img)
    try? handler.perform([req])
    for obs in req.results ?? [] {
        if let cand = obs.topCandidates(1).first { print(cand.string) }
    }
}
