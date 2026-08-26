// Local OCR for scanned recorded documents, via PDFKit + Vision.
//
// County CC&R scans carry no text layer, which makes them unreadable to search
// engines, to answer engines, and to us. Vision runs on-device, so a 30,000-page
// corpus costs nothing but time and no page leaves this machine.
//
// usage: ocr <pdf-path> [max-pages]   -> recognized text on stdout

import Foundation
import PDFKit
import Vision
import CoreGraphics

let args = CommandLine.arguments
guard args.count >= 2 else {
    FileHandle.standardError.write("usage: ocr <pdf> [max-pages]\n".data(using: .utf8)!)
    exit(2)
}
let path = args[1]
let maxPages = args.count > 2 ? (Int(args[2]) ?? 1) : 1

guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else {
    FileHandle.standardError.write("cannot open pdf\n".data(using: .utf8)!)
    exit(3)
}

let pageLimit = min(maxPages, doc.pageCount)
var out = ""

for i in 0..<pageLimit {
    guard let page = doc.page(at: i) else { continue }
    let rect = page.bounds(for: .mediaBox)
    // 2x is enough for typewritten and stamped county text; higher scales cost
    // time without improving recognition on microfilm-era scans.
    let scale: CGFloat = 2.0
    let w = Int(rect.width * scale)
    let h = Int(rect.height * scale)
    guard w > 0, h > 0, w < 20000, h < 20000 else { continue }

    guard let ctx = CGContext(
        data: nil, width: w, height: h,
        bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { continue }

    ctx.setFillColor(CGColor(gray: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: scale, y: scale)
    ctx.translateBy(x: -rect.origin.x, y: -rect.origin.y)
    page.draw(with: .mediaBox, to: ctx)

    guard let img = ctx.makeImage() else { continue }

    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = true
    req.revision = VNRecognizeTextRequestRevision3

    let handler = VNImageRequestHandler(cgImage: img, options: [:])
    do { try handler.perform([req]) } catch { continue }

    for obs in (req.results ?? []) {
        if let c = obs.topCandidates(1).first { out += c.string + "\n" }
    }
    out += "\n<<<PAGE \(i + 1)>>>\n"
}

print(out)
