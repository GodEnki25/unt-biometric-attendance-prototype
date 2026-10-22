# Consent-Driven Smart Attendance System Using Facial Recognition – User Manual
**Version:** 1.0
**Team Name:** Team 3 JetSet
**Date:** 10/11/2026
---
## 1. Introduction

The Consent-Driven Smart Attendance System is a mobile-based classroom attendance application that combines geofencing and facial recognition to verify student presence and identity. It is designed for students and instructors, allowing students to check in within a predefined classroom boundary while instructors manage attendance records and make corrections when necessary. The system provides a privacy-conscious attendance solution that operates independently of the Canvas database while maintaining a Canvas-aligned attendance model.

---
## 2. System Requirements
### Instructor
**Hardware**
- Windows 10/11 or macOS desktop computer
- Internet-connected desktop machine

**Software**
- Python 3.11+
- Node.js with npm
- Chromium or Firefox desktop browser
- SQLite for local attendance record storage
- Docker Desktop and WSL2
- Git for repository management
- Location permissions enabled on the system/browser

_
### Student
**Hardware**
- Android 13+ or iOS 16+
- Mobile device with GPS and camera support
- Active internet connection


**Software**
- Expo Go app
- Location permissions enabled
- Camera permissions enabled
- Active internet connection

_

---
## 3. Installation Guide


### Instructor
**Step 1:** Download/Clone repository from Github

**Step 2:** If using WSL2 with Docker Desktop, start Docker Desktop in Windows first and wait until it is fully running.

**Step 3:**
From the project root run this command:
```bash
chmod +x start-dev.sh
./start-dev.sh
```
**If this does not work then follow the below steps from the project root (after step 1).**

**Step 2:** Depending on the system, from the project root run these commands:

#### Windows
``` bash
cd backend
python3 -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
cd .. 
cd react_demo/reactDemo
npm install
```
#### WSL / Linux / macOS
``` bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd .. 
cd react_demo/reactDemo
npm install
```
### Student
**Step 1:** Downlaod the ExpoGo App

**Step 2:** Scan the QR Code or link provided by the instructor

---
## 4. Getting Started
### Instructor
1. Launch the app from the project root using the built-in Command Prompt by running this command with
```bash
chmod +x start-dev.sh
./start-dev.sh
```
2. The Command Prompt will give a link that should be opened on a desktop browser which will take you to the instructor login page
3. On the page there should be a button to sign up. Enter the necessary information such as name, email, password and press the Create Account button.
4. Use the created accounts login information to get to the main menu for the instructor app.
### Student
1. Scan the QR code or type the link given by the instructor which should take you to the Expo Go app. Will take a few seconds to load and take you to the login page.
2. On the login page press the Enroll Face link to navigate to the sign up page and enter the name, email, student ID number, and password then press the Signup Button.
3. It will ask for permission to use you camera at this point. Press Accept to the Terms and Conditions.
4. The program will then scan your face 10 times to create the facial recognition data used to check in.
5. After the process login with the details you used to create the account and it will take you to the main menu for the students main menu.
---
## 5. Features & Functions
### Feature 1: Student Facial Recognition Verification and Data Registration
**Description:** This feature allows students to register their facial data and verify their identity during attendance check-in. Students enroll their facial information through the mobile application, which is later used to confirm their identity. Facial recognition is performed locally on the device without storing raw facial images.

**How to Use It:** 
1. Open the student application on a mobile device.
2. Select the student Enroll Face option.
3. Enter the required student registration information.
4. Proceed to the facial enrollment screen.
5. [Position your face inside the camera frame and follow the instructions to register your facial data.!](images/Feat1img1.png)
6. Once registration is completed, log into the student application.
7. When an instructor starts an attendance session, select the Check In button on the student dashboard.
8. [Position your face within the camera frame to verify your identity.](images/Feat1img2.png)
9. Facial Verification is successful, followed by proceeding with the geofence check-in process.
### Feature 2: Geofence Verification
**Description:** Geofence verification confirms that a student is physically located within the designated attendance boundary before completing check-in. The instructor establishes a configurable geofence radius around the host device when creating an attendance session. Students must be within this boundary to complete the location verification process.

**How to Use It:** 
1. [From the instructor dashboard, configure the geofence radius for the attendance session and start the session.](images/Feat2img1.png)
2. On the student device, log into the mobile application.
3. Select Check In from the student dashboard and complete the required facial recognition verification.
4. Move within the designated geofence boundary.
5. [The application allows for checks when the student device is within the session's configured geofence.](images/Feat2img2.png)
### Feature 3: Instructor Access to Previous Attendance Records
**Description:** This feature allows instructors to access attendance records from previously completed sessions. Instructors can filter attendance records by course, date, and classroom to review student attendance information. Records are stored locally and can also be exported as CSV files.

**How to Use It:** 
1. Open the instructor application through a desktop browser and login.
2. [From the instructor dashboard, locate the dropdown menus at the top of the page and select the appropriate course, date, and classroom.](images/Feat3img1.png)
3. [The dashboard displays the attendance records matching the previous session that's been selected.](images/Feat3img2.png)
4. Select the Export to CSV option to get the records that should be shown in the dashboard.
### Feature 4: Attendance Status Classification
**Description:** This feature automatically classifies student attendance as Present, Late, or Absent based on when students check in relative to the start of the attendance session. Students checking in within 15 minutes of the session starting are classified as Present, while students checking in after 15 minutes are classified as Late. Students who do not check in are classified as Absent.

**How to Use It:** 
1. Log into the instructor dashboard and start an attendance session.
2. Students checking in within 15 minutes of the session starting are classified as Present, while students checking in after 15 minutes are classified as Late. Students who do not check in are classified as Absent.
3. [After the session is done, check the session that was just completed and it will display the appropriate statuses.](images/Feat4.png)
### Feature 5: Instructor Manual Override
**Description:** This feature allows instructors to manually change a student's attendance status when a correction is necessary. Instructors can select a different attendance classification and provide a reason for the modification. Once saved, the updated status is reflected in the student's attendance record.

**How to Use It:** 
1. Open the instructor application through a desktop browser and login.
2. From the instructor dashboard, locate the dropdown menus at the top of the page and select the appropriate course, date, and classroom.
3. After choosing the appropriate class, pick the override button at the bottom which will take you to the override screen.
4. [In the list of students, click the status of the student that you wish to change/override which will take you to the override form.](images/Feat5img1.png)
5. [Click the dropdown menu with the statuses to choose what status you want to override the current status with and input a reason if needed and click save changes.](images/Feat5img2.png)
6. The status of that student should have changed when viewing it from the dashboard.
### Feature 6: Geofence Tracking
**Description:** This feature periodically checks whether a student remains inside the designated geofence during an active attendance session. The system records timestamps when a student enters, exits, or re-enters the geofence. These timestamps are used to determine how long the student remained within the attendance boundary. The documented testing procedure uses a 10-minute wait to guarantee a periodic location check.

**How to Use It:** 
1. Open the instructor application through a desktop browser and login.
2. From the instructor dashboard, configure the geofence radius for the attendance session and start the session.
3. With a student device login and go through the checkin process to the session.
4. When a student leaves the geofence of the session, the system will record when that event happened and mark the student as leaving the session.
5. If the student comes back into the session, the system will record when the event happens and mark the student as reentering the session.
6. At the end of the session, the system will save the records and mark the total time the student was in the session which does not include the time that the student was outside of the geofence.
---
## 6. Troubleshooting examples
| Problems | Causes | Solutions|
|---------|----------------|----------|
| ./start-dev.sh does not work | Issue with expo not being properly installed | run `npm install` in the `react_demo/reactDemo` folder |
Student cannot connect to the application through Expo Go using the provided QR code | Not connected to the same network | Make sure that the student's mobile device is connected to the same network as the device that is running the session |
| Camera does not activate during facial enrollment or verification | Camera is missing permissions or disabled | Enable permissions or make sure the camera is working properly and is up to date
| Facial enrollment fails or gets stuck  | System cannot recognize the face clearly | Move to a brightly lit room where the camera can see your face clearly  |
| Instructor cannot start or create a new attendance session  | The sessions radius has not been set | Allow for the system to view the location of your device and create the geofence through the radius settings  |
| Student is unable to check in while physically inside the geofence boundary.  | The devices settings may not be allowing for an accurate location | Allow location permissions for precise location and retry the check-in process. |
## 7. Contact Information
**Support Email:** 

AndresMoreira@my.unt.edu 

ShayanKarki@my.unt.edu 

SorelAgbogla@my.unt.edu 

AndrewKim13@my.unt.edu

**Project Repository:** 

https://github.com/GodEnki25/unt-biometric-attendance-prototype

