import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
}).single("file");

const uploadFile = (req, res, next) => {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File must be 25MB or smaller" });
    }
    return res.status(400).json({ message: err.message });
  });
};

export default uploadFile;
