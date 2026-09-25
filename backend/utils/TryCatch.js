const TryCatch = (handler) => {
    return async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        // If headers were already sent (e.g., during streaming), we cannot
        // call res.status().json(). Instead, write an NDJSON error line
        // and end the stream gracefully.
        if (res.headersSent) {
          if (!res.writableEnded) {
            try {
              res.write(
                JSON.stringify({ type: "error", content: error.message }) + "\n"
              );
              res.end();
            } catch (_) {
              // stream already closed, nothing we can do
            }
          }
          return;
        }
        res.status(500).json({
          message: error.message,
        });
      }
    };
  };
  
  export default TryCatch;