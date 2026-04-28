import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const appServiceMock: Pick<AppService, "getHealth"> = {
      getHealth: async () => ({
        status: "ok",
        service: "zentra-backend",
        database: "up",
        timestamp: new Date().toISOString(),
      }),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: appServiceMock,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("health", () => {
    it("should return health payload", async () => {
      const response = await appController.getHealth();
      expect(response.service).toBe("zentra-backend");
    });
  });
});
