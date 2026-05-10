/**
 * ============================================================
 * FIREBASE CONFIGURATION & SERVICES
 * أكاديمية اجتهاد - الإعدادات المركزية
 * ============================================================
 * 
 * هذا الملف يحتوي على:
 * 1. إعدادات Firebase (يجب تعديلها بإعدادات مشروعك)
 * 2. خدمة المصادقة (Auth Service)
 * 3. خدمة قاعدة البيانات (Firestore Service)
 */

// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyBaUcWQYMt9IxvjK_05baGVy0Wz-5il3p0",
  authDomain: "student-2512b.firebaseapp.com",
  projectId: "student-2512b",
  storageBucket: "student-2512b.firebasestorage.app",
  messagingSenderId: "1059240260297",
  appId: "1:1059240260297:web:be94c123ac36c3e8445318",
  measurementId: "G-B870D71R5K"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// إعدادات اللغة العربية للرسائل
auth.languageCode = 'ar';

// ==================== AUTH SERVICE ====================
const AuthService = {

    // الحصول على المستخدم الحالي
    getCurrentUser() {
        return auth.currentUser;
    },

    // مراقبة حالة تسجيل الدخول
    onAuthChanged(callback) {
        return auth.onAuthStateChanged(callback);
    },

    // تسجيل حساب جديد
    async register(email, password, userData) {
        try {
            console.log("Attempting to create user in Auth...");
            const result = await auth.createUserWithEmailAndPassword(email, password);
            const user = result.user;

            console.log("User created in Auth. UID:", user.uid);
            console.log("Saving user data to Firestore...");

            // تحديث اسم المستخدم في Auth
            await user.updateProfile({ displayName: userData.name });

            // حفظ بيانات المستخدم في Firestore
            const profileData = {
                uid: user.uid,
                name: userData.name,
                email: email,
                role: userData.role || 'student',
                gradeId: userData.gradeId || '',
                avatar: userData.avatar || '🧑‍🎓',
                phone: userData.phone || '',
                xp: 0,
                level: 1,
                streak: 0,
                lastActive: new Date().toDateString(),
                completedLessons: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(user.uid).set(profileData);
            console.log("User data successfully saved to Firestore!");

            return { success: true, user };
        } catch (error) {
            console.error("Registration error:", error);
            return { success: false, error: AuthService.translateError(error.code) };
        }
    },

    // تسجيل الدخول
    async login(email, password) {
        try {
            console.log("Attempting login...");
            const result = await auth.signInWithEmailAndPassword(email, password);
            console.log("Login successful!");
            return { success: true, user: result.user };
        } catch (error) {
            console.error("Login error:", error);
            return { success: false, error: AuthService.translateError(error.code) };
        }
    },

    // تسجيل الخروج
    async logout() {
        try {
            await auth.signOut();
            console.log("User logged out.");
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // جلب بيانات المستخدم من Firestore
    async getUserData(uid) {
        try {
            console.log("Fetching user data for UID:", uid);
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                console.log("User data found:", doc.data());
                return doc.data();
            }
            console.warn("No user document found in Firestore for UID:", uid);
            return null;
        } catch (error) {
            console.error('Error fetching user data from Firestore:', error);
            return null;
        }
    },

    // تحديث بيانات المستخدم
    async updateUserData(uid, data) {
        try {
            await db.collection('users').doc(uid).update(data);
            return true;
        } catch (error) {
            console.error('Error updating user data:', error);
            return false;
        }
    },

    // ترجمة رسائل الخطأ للعربية
    translateError(code) {
        const errors = {
            'auth/email-already-in-use': 'هذا البريد الإلكتروني مسجل بالفعل',
            'auth/invalid-email': 'البريد الإلكتروني غير صالح',
            'auth/operation-not-allowed': 'العملية غير مسموح بها',
            'auth/weak-password': 'كلمة المرور ضعيفة جداً (6 أحرف على الأقل)',
            'auth/user-disabled': 'تم تعطيل هذا الحساب',
            'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
            'auth/wrong-password': 'كلمة المرور غير صحيحة',
            'auth/invalid-credential': 'بيانات الدخول غير صحيحة',
            'auth/too-many-requests': 'تم تجاوز عدد المحاولات. حاول لاحقاً',
            'auth/network-request-failed': 'خطأ في الاتصال بالإنترنت'
        };
        return errors[code] || 'حدث خطأ غير متوقع. حاول مجدداً';
    }
};

// ==================== FIRESTORE DB SERVICE ====================
const FireDB = {

    // -------- المواد الدراسية --------

    // جلب كافة المواد
    async getSubjects() {
        try {
            const snapshot = await db.collection('subjects').get();
            const subjects = {};
            snapshot.forEach(doc => {
                subjects[doc.id] = doc.data();
            });
            return subjects;
        } catch (error) {
            console.error('Error fetching subjects:', error);
            return {};
        }
    },

    // حفظ مادة (إضافة أو تعديل)
    async saveSubject(id, subjectData) {
        try {
            await db.collection('subjects').doc(id).set(subjectData, { merge: true });
            return true;
        } catch (error) {
            console.error('Error saving subject:', error);
            return false;
        }
    },

    // حذف مادة
    async deleteSubject(id) {
        try {
            await db.collection('subjects').doc(id).delete();
            return true;
        } catch (error) {
            console.error('Error deleting subject:', error);
            return false;
        }
    },

    // -------- بيانات الطالب --------

    // جلب تقدم الطالب
    async getStudentProgress(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                return {
                    xp: data.xp || 0,
                    level: data.level || 1,
                    streak: data.streak || 0,
                    completedLessons: data.completedLessons || [],
                    lastActive: data.lastActive || ''
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching student progress:', error);
            return null;
        }
    },

    // تحديث تقدم الطالب
    async updateStudentProgress(uid, progressData) {
        try {
            await db.collection('users').doc(uid).update(progressData);
            return true;
        } catch (error) {
            console.error('Error updating progress:', error);
            return false;
        }
    },

    // إضافة درس مكتمل
    async addCompletedLesson(uid, lessonId) {
        try {
            await db.collection('users').doc(uid).update({
                completedLessons: firebase.firestore.FieldValue.arrayUnion(lessonId)
            });
            return true;
        } catch (error) {
            console.error('Error adding completed lesson:', error);
            return false;
        }
    },

    // -------- الإحصائيات --------

    async getStats() {
        try {
            const subjects = await this.getSubjects();
            const subjectCount = Object.keys(subjects).length;
            let lessonCount = 0;
            for (let id in subjects) {
                if (subjects[id].units) {
                    subjects[id].units.forEach(u => {
                        if (u.lessons) lessonCount += u.lessons.length;
                    });
                }
            }
            // عدد الطلاب
            const usersSnap = await db.collection('users').where('role', '==', 'student').get();
            return {
                subjects: subjectCount,
                lessons: lessonCount,
                students: usersSnap.size
            };
        } catch (error) {
            console.error('Error fetching stats:', error);
            return { subjects: 0, lessons: 0, students: 0 };
        }
    },

    // البحث عن درس بالمعرف
    async findLessonById(lessonId) {
        const subjects = await this.getSubjects();
        for (let subjId in subjects) {
            if (subjects[subjId].units) {
                for (let unit of subjects[subjId].units) {
                    if (unit.lessons) {
                        const found = unit.lessons.find(l => l.id === lessonId);
                        if (found) return found;
                    }
                }
            }
        }
        return null;
    }
};
