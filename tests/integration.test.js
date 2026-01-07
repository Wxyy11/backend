const request = require("supertest");
// ตรวจสอบให้แน่ใจว่าไฟล์ server.js ถูก export เป็น module.exports = app;
// และ supertest สามารถเข้าถึงได้ผ่าน path "../index"
const app = require("../index"); 

describe("User Management Integration Test", () => {
    // กำหนดตัวแปรสำหรับเก็บข้อมูลที่ใช้ระหว่างการทดสอบ
    let createdUserId;
    let authToken;
    const testUser = {
        // แก้ไขฟิลด์ให้ตรงกับ server.js
        firstname: "Test",
        fullname: "Test User",
        lastname: "Integration",
        username: "test_integration@mail.com", // เปลี่ยน email เป็น username
        password: "securepassword123", // ใช้รหัสผ่านที่ซับซ้อนขึ้น
        status: 1 // กำหนด status
    };
    const updatedName = "Updated Test";
    const newPassword = "newsecurepassword456"; // ✅ เพิ่มการประกาศตัวแปรนี้

    // --- 1. POST /users (Register) ---
    test("TC-REG-01: POST /users - Successfully create a new user (Register)", async () => {
        const res = await request(app)
            .post("/users")
            .send(testUser);

        // ตรวจสอบสถานะการสร้าง (201 Created)
        expect(res.statusCode).toBe(201);
        // ตรวจสอบว่ามี ID ถูกสร้างขึ้นมา
        expect(res.body).toHaveProperty("id");
        
        // เก็บ ID ผู้ใช้ที่สร้างเพื่อใช้ในการทดสอบต่อ
        createdUserId = res.body.id;
        
        // ตรวจสอบข้อมูลที่ถูกส่งกลับ
        expect(res.body.username).toBe(testUser.username);
        expect(res.body.fullname).toBe(testUser.fullname);
    });

    // --- 2. POST /users (Duplicate Username) ---
    test("TC-REG-02: POST /users - Should fail with status 409 if username already exists", async () => {
        const res = await request(app)
            .post("/users")
            .send(testUser);

        // คาดหวังสถานะ 409 Conflict (จากการแก้ไขโค้ด server.js)
        expect(res.statusCode).toBe(409);
        expect(res.body).toHaveProperty("error", "Username already exists");
    });


    // --- 3. POST /login ---
    test("TC-LOGIN-01: POST /login - Successfully login with correct credentials", async () => {
        const res = await request(app)
            .post("/login")
            .send({
                username: testUser.username, // เปลี่ยน email เป็น username
                password: testUser.password
            });

        // ตรวจสอบสถานะ (200 OK)
        expect(res.statusCode).toBe(200);
        // ตรวจสอบว่าได้รับ Token
        expect(res.body).toHaveProperty("token");
        
        // เก็บ Token เพื่อใช้ในการทดสอบ Protected Route
        authToken = res.body.token;
    });

    // --- 4. GET /protected-user (Protected Route) ---
    test("TC-AUTH-01: GET /protected-user - Should retrieve profile using valid token", async () => {
        const res = await request(app)
            .get("/protected-user")
            .set('Authorization', `Bearer ${authToken}`); // ใช้ Token ที่ได้รับ
        
        // ตรวจสอบสถานะ (200 OK)
        expect(res.statusCode).toBe(200);
        expect(res.body.id).toBe(createdUserId);
        expect(res.body.fullname).toBe(testUser.fullname);
        // ตรวจสอบว่าไม่มี password ถูกส่งกลับมา
        expect(res.body).not.toHaveProperty("password");
    });
    
    // --- 5. GET /users/:id ---
    test("TC-READ-01: GET /users/:id - Should retrieve the created user by ID", async () => {
        const res = await request(app)
            .get(`/users/${createdUserId}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.id).toBe(createdUserId);
    });

    // --- 6. PUT /users/:id (Update) ---
    // ✅ โค้ดถูกนำกลับเข้ามาใน test() block ที่ถูกต้องแล้ว
    test("TC-UPDATE-01: PUT /users/:id - Successfully update user's fullname and password", async () => {
        const res = await request(app)
            .put(`/users/${createdUserId}`)
            .send({
                // ส่งข้อมูลทุกฟิลด์เพื่อความสมบูรณ์และลดโอกาส Error 500
                firstname: testUser.firstname, 
                fullname: updatedName, // เปลี่ยนชื่อ
                lastname: testUser.lastname,
                username: testUser.username,
                password: newPassword, // รหัสผ่านใหม่
                status: testUser.status 
            });

        // คาดหวัง 200 (แต่ถ้า server.js มี Error 500 จริง ๆ การทดสอบนี้จะล้มเหลวที่บรรทัดนี้)
        expect(res.statusCode).toBe(200); 
        expect(res.body.message).toBe("User updated successfully");
    });

    // ✅ เพิ่มการทดสอบยืนยันการอัปเดต (Verification) ก่อน Search
    test("TC-VERIFY-UPDATE: GET /users/:id - Verify updated fullname before search", async () => { 
        const res = await request(app)
            .get(`/users/${createdUserId}`);
            
        // คาดหวัง 200 และชื่อที่เปลี่ยนไปแล้ว
        expect(res.statusCode).toBe(200);
        expect(res.body.fullname).toBe(updatedName);
    });

    // --- 7. GET /users/search (Search) ---
    test("TC-SEARCH-01: GET /users/search?fullname=... - Should find user by updated name", async () => {
        const res = await request(app)
            .get(`/users/search?fullname=${updatedName}`); 
        
        // คาดหวัง 200 และผลลัพธ์การค้นหา
       expect(res.statusCode).toBe(200);
        expect(res.body[0].fullname).toBe(updatedName); 
    });

    // --- 8. DELETE /users/:id ---
    test("TC-DELETE-01: DELETE /users/:id - Successfully delete the user", async () => {
        const res = await request(app)
            .delete(`/users/${createdUserId}`);

        // คาดหวัง 200 OK 
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe("User deleted successfully");
    });

    // --- 9. GET /users/:id (Verify Deletion) ---
    test("TC-DELETE-02: GET /users/:id - Should return 404 after deletion (Verification)", async () => {
        const res = await request(app)
            .get(`/users/${createdUserId}`);
        
        // ✅ แก้ไข: คาดหวัง 404 Not Found เพื่อยืนยันว่าผู้ใช้ถูกลบไปแล้ว (ถูกต้องตาม Logic)
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("User not found");
    });
});