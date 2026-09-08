const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();


// =====================================================
// CARTELLE
// =====================================================

const uploadDirectories = {
    ar: path.join(__dirname, "../../uploads/3d"),
    image: path.join(__dirname, "../../uploads/images"),
    video: path.join(__dirname, "../../uploads/videos"),
    pdf: path.join(__dirname, "../../uploads/pdfs")
};


Object.values(uploadDirectories).forEach((directory) => {

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, {
            recursive: true
        });
    }

});


// =====================================================
// STORAGE
// =====================================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        const type =
            req.body.type;

        const directory =
            uploadDirectories[type];

        if (!directory) {

            return cb(
                new Error(
                    "Tipo di file non supportato"
                )
            );

        }

        cb(null, directory);

    },


    filename: (req, file, cb) => {

        const extension =
            path.extname(file.originalname)
            .toLowerCase();

        const uniqueName =
            `${Date.now()}-${Math.round(
                Math.random() * 1000000000
            )}${extension}`;

        cb(
            null,
            uniqueName
        );

    }

});


// =====================================================
// TIPI CONSENTITI
// =====================================================

const allowedMimeTypes = {

    ar: [
        "model/vnd.usdz+zip",
        "application/octet-stream"
    ],

    image: [
        "image/jpeg",
        "image/png",
        "image/webp"
    ],

    video: [
        "video/mp4",
        "video/webm"
    ],

    pdf: [
        "application/pdf"
    ]

};


// =====================================================
// FILTRO
// =====================================================

const fileFilter = (
    req,
    file,
    cb
) => {

    const type =
        req.body.type;

    const allowed =
        allowedMimeTypes[type];


    if (!allowed) {

        return cb(
            new Error(
                "Tipo di contenuto non supportato"
            )
        );

    }


    if (
        !allowed.includes(
            file.mimetype
        )
    ) {

        return cb(
            new Error(
                `Formato file non valido per ${type}`
            )
        );

    }


    cb(null, true);

};


// =====================================================
// MULTER
// =====================================================

const upload = multer({

    storage,

    fileFilter,

    limits: {

        fileSize:
            100 * 1024 * 1024

    }

});


// =====================================================
// POST /api/upload
// =====================================================

router.post(
    "/",
    upload.single("file"),
    (req, res) => {

        if (!req.file) {

            return res.status(400).json({

                error:
                    "Nessun file ricevuto"

            });

        }


        const type =
            req.body.type;


        const folder =
            type === "ar"
                ? "3d"
                : `${type}s`;


        const fileUrl =
            `/uploads/${folder}/${req.file.filename}`;


        res.status(201).json({

            success: true,

            original_name:
                req.file.originalname,

            filename:
                req.file.filename,

            type,

            mime_type:
                req.file.mimetype,

            size:
                req.file.size,

            url:
                fileUrl

        });

    }
);


// =====================================================
// ERRORI MULTER
// =====================================================

router.use(
    (error, req, res, next) => {

        console.error(error);

        res.status(400).json({

            error:
                error.message ||
                "Errore durante upload"

        });

    }
);


module.exports = router;
