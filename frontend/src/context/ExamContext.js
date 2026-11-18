/**
 * ExamLAN Pro - Exam Lifecycle Context
 */

class ExamContextState {
    constructor() {
        this.quizzes = [];
        this.currentQuiz = null;
        this.attemptToken = null;
        this.currentQuestionIdx = 0;
        this.studentAnswers = {};
        this.timeRemaining = 0;
        this.violationCount = 0;
        this.currentStudentResult = null;
        this.pendingExamInfo = null;
        this.pendingResumeData = null;
        this.answerReviewVisible = false;
        this.saveStatus = { text: '⟳ Menyambungkan…', color: 'text-slate-500' };
        this.listeners = new Set();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(fn => {
            try { fn(this); } catch (e) { console.error(e); }
        });
    }

    setQuizzes(quizzes) {
        this.quizzes = Array.isArray(quizzes) ? quizzes : [];
        this.notify();
    }

    setCurrentQuiz(quiz) {
        this.currentQuiz = quiz;
        this.notify();
    }

    setAttemptToken(token) {
        this.attemptToken = token;
        this.notify();
    }

    setQuestionIndex(idx) {
        this.currentQuestionIdx = idx;
        this.notify();
    }

    setAnswers(answers) {
        this.studentAnswers = answers || {};
        this.notify();
    }

    setAnswer(qIdx, val) {
        this.studentAnswers[qIdx] = val;
        this.notify();
    }

    setTimeRemaining(seconds) {
        this.timeRemaining = Math.max(0, seconds || 0);
        this.notify();
    }

    setViolationCount(count) {
        this.violationCount = Number(count) || 0;
        this.notify();
    }

    incrementViolation() {
        this.violationCount++;
        this.notify();
    }

    setSaveStatus(text, color = 'text-slate-500') {
        this.saveStatus = { text, color };
        this.notify();
    }

    setResult(result) {
        this.currentStudentResult = result;
        this.notify();
    }

    setPendingExamInfo(info) {
        this.pendingExamInfo = info;
        this.notify();
    }

    setPendingResumeData(data) {
        this.pendingResumeData = data;
        this.notify();
    }

    setAnswerReviewVisible(visible) {
        this.answerReviewVisible = !!visible;
        this.notify();
    }

    isExamActive() {
        return !!this.attemptToken && !this.currentStudentResult;
    }

    clearExam() {
        this.currentQuiz = null;
        this.attemptToken = null;
        this.currentQuestionIdx = 0;
        this.studentAnswers = {};
        this.timeRemaining = 0;
        this.violationCount = 0;
        this.currentStudentResult = null;
        this.pendingExamInfo = null;
        this.pendingResumeData = null;
        this.answerReviewVisible = false;
        this.notify();
    }
}

export const ExamContext = new ExamContextState();
