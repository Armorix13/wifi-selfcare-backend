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

const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    const mimeType = file.mimetype;
    if (mimeType.startsWith("image/")) {
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
    const fileExtension = mime.extension(file.mimetype);
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
    const mimeType = file.mimetype;
    // Accept all image/* types, including svg, gif, webp, bmp, tiff, ico, etc.
    if (mimeType.startsWith("image/")) {
      cb(null, true);
    } else if (
      mimeType === "application/pdf" ||
      mimeType.startsWith("video/") ||
      mimeType.startsWith("audio/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

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
