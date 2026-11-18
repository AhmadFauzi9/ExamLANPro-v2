/**
 * ExamLAN Pro - Global Application State Aggregator
 */

import { StudentContext } from '../context/StudentContext.js';
import { ExamContext } from '../context/ExamContext.js';

export const AppState = {
    student: StudentContext,
    exam: ExamContext
};
