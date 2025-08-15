import fs from "fs";
import path from "path";
import multer, { StorageEngine, FileFilterCallback } from "multer";
import mime from "mime-types";
import { v4 as uuidv4 } from "uuid";
import { Request, Response, NextFunction } from "express";

const imageDir = path.join(__dirname.split("dist")[0], "view", "image");
const pdfDir = path.join(__dirname.split("dist")[0], "view", "pdf");
const videoDir = path.join(__dirname.split("dist")[0], "view", "video");
const audioDir = path.join(__dirname.split("dist")[0], "view", "audio");

if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico', '.svg'];

const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    const mimeType = file.mimetype;
    const originalName = file.originalname.toLowerCase();
    if (mimeType.startsWith("image/") || (mimeType === "application/octet-stream" && allowedImageExtensions.some(ext => originalName.endsWith(ext)))) {
      cb(null, imageDir);
    } else if (mimeType === "application/pdf") {
      cb(null, pdfDir);
    } else if (mimeType.startsWith("video/")) {
      cb(null, videoDir);
    } else if (mimeType.startsWith("audio/")) {
      cb(null, audioDir);
    } else {
      cb(new Error("Unsupported file type"), imageDir); // fallback to imageDir, won't be used
    }
  },
  filename: (req, file, cb) => {
    let fileExtension = mime.extension(file.mimetype);
    const originalName = file.originalname.toLowerCase();
    if (file.mimetype === "application/octet-stream") {
      // Try to get extension from original filename
      const matchedExt = allowedImageExtensions.find(ext => originalName.endsWith(ext));
      if (matchedExt) {
        fileExtension = matchedExt.replace('.', '');
      }
    }
    if (!fileExtension) {
      cb(new Error("Unsupported file type"), "");
    } else {
      const fileName = `${uuidv4()}-${Date.now()}.${fileExtension}`;
      cb(null, fileName);
    }
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb: FileFilterCallback) => {
    console.log(file);
    console.log(file.mimetype);
    const mimeType = file.mimetype;
    const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico', '.svg'];
    // Accept all image/* types, including svg, gif, webp, bmp, tiff, ico, etc.
    if (mimeType.startsWith("image/")) {
      cb(null, true);
    } else if (
      mimeType === "application/pdf" ||
      mimeType.startsWith("video/") ||
      mimeType.startsWith("audio/")
    ) {
      cb(null, true);
    } else if (
      mimeType === "application/octet-stream" &&
      allowedImageExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext))
    ) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

export { upload }; // Export Multer instance for .single, .array, .fields
export const multerUpload = upload.single("image");

export const handleMulterUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    return next(new Error("File is required"));
  }
  // Always extract /view/... from the file path, regardless of dist or src
  const absolutePath = req.file.path.replace(/\\/g, "/");
  const viewIndex = absolutePath.lastIndexOf("/view/");
  let fileUrl = absolutePath;
  if (viewIndex !== -1) {
    fileUrl = absolutePath.substring(viewIndex);
  }
  // Ensure it always starts with /view/
  if (!fileUrl.startsWith("/view/")) {
    fileUrl = `/view/${fileUrl.split("/view/")[1]}`;
  }
  res.status(200).json({
    message: `${
      req.file.mimetype.startsWith("image/")
        ? "Image"
        : req.file.mimetype.startsWith("video/")
        ? "Video"
        : req.file.mimetype.startsWith("audio/")
        ? "Audio"
        : "PDF"
    } uploaded successfully`,
    url: fileUrl,
  });
};

// NEW ADDITIONS FOR BILL UPLOAD SYSTEM - KEEPING EXISTING CODE INTACT

// Bill upload configuration
const billUpload = multer({
  storage: storage, // Use the same storage as existing upload
  fileFilter: (req, file, cb: FileFilterCallback) => {
    const mimeType = file.mimetype;
    const originalName = file.originalname.toLowerCase();
    
    // Allow PDF, images, and common document formats for bills
    if (mimeType === "application/pdf") {
      cb(null, true);
    } else if (mimeType.startsWith("image/")) {
      cb(null, true);
    } else if (mimeType.includes("document") || mimeType.includes("word") || 
               originalName.endsWith('.doc') || originalName.endsWith('.docx') || 
               originalName.endsWith('.txt') || originalName.endsWith('.rtf')) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type for bill. Only PDF, images, and documents are allowed."));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for bills
  }
});

// Payment proof upload configuration
const paymentProofUpload = multer({
  storage: storage, // Use the same storage as existing upload
  fileFilter: (req, file, cb: FileFilterCallback) => {
    const mimeType = file.mimetype;
    
    // Allow images and PDFs for payment proofs
    if (mimeType.startsWith("image/")) {
      cb(null, true);
    } else if (mimeType === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type for payment proof. Only images and PDFs are allowed."));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for payment proofs
  }
});

// Export new upload instances alongside existing ones
export { billUpload, paymentProofUpload };

// Bill upload handler
export const handleBillUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    return next(new Error("Bill file is required"));
  }
  
  const absolutePath = req.file.path.replace(/\\/g, "/");
  const viewIndex = absolutePath.lastIndexOf("/view/");
  let fileUrl = absolutePath;
  
  if (viewIndex !== -1) {
    fileUrl = absolutePath.substring(viewIndex);
  }
  
  if (!fileUrl.startsWith("/view/")) {
    fileUrl = `/view/${fileUrl.split("/view/")[1]}`;
  }
  
  res.status(200).json({
    message: "Bill uploaded successfully",
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype
  });
};

// Payment proof upload handler
export const handlePaymentProofUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    return next(new Error("Payment proof file is required"));
  }
  
  const absolutePath = req.file.path.replace(/\\/g, "/");
  const viewIndex = absolutePath.lastIndexOf("/view/");
  let fileUrl = absolutePath;
  
  if (viewIndex !== -1) {
    fileUrl = absolutePath.substring(viewIndex);
  }
  
  if (!fileUrl.startsWith("/view/")) {
    fileUrl = `/view/${fileUrl.split("/view/")[1]}`;
  }
  
  res.status(200).json({
    message: "Payment proof uploaded successfully",
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype
  });
};

