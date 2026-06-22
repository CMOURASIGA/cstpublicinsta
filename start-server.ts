import app, { initializeApp } from "./server";

const PORT = Number(process.env.PORT || 3000);

async function bootstrap() {
  await initializeApp({ enableStatic: true });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[InstaFlow] Server running on http://localhost:${PORT}`);
  });
}

void bootstrap();
