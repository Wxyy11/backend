const request = require("supertest");
const app = require("../app");

describe("Integration Test", () => {

    test("POST /users - create user", async () => {
        const res = await request(app)
            .post("/users")
            .send({
                name: "Wayy",
                email: "Wayy@mail.com",
                password: "123456"
            });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");
    });

    test("POST /login - login user", async () => {
        const res = await request(app)
            .post("/login")
            .send({
                email: "test@mail.com",
                password: "123456"
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("token");
    });
});