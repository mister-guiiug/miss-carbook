// Catalogue de messages fr + en de Miss Carbook.
//
// Les groupes vivent dans ./groups/*.ts (une paire `<groupe>Fr` / `<groupe>En`
// de forme strictement identique par groupe) et sont assemblés ici en un seul
// dictionnaire typé. `t('groupe.cle')` est vérifié à la compilation via
// `I18nPaths<Messages>`; les valeurs dynamiques utilisent des placeholders
// `{param}` interpolés à l'exécution.
import { commonFr, commonEn } from './groups/common';
import { appFr, appEn } from './groups/app';
import { navFr, navEn } from './groups/nav';
import { homeFr, homeEn } from './groups/home';
import { accountFr, accountEn } from './groups/account';
import { assistantFr, assistantEn } from './groups/assistant';
import { authFr, authEn } from './groups/auth';
import { dialogFr, dialogEn } from './groups/dialog';
import { uiFr, uiEn } from './groups/ui';
import { budgetFr, budgetEn } from './groups/budget';
import { candidatesFr, candidatesEn } from './groups/candidates';
import { candidateDetailFr, candidateDetailEn } from './groups/candidateDetail';
import { compareFr, compareEn } from './groups/compare';
import { evaluationsFr, evaluationsEn } from './groups/evaluations';
import { remindersFr, remindersEn } from './groups/reminders';
import { requirementsFr, requirementsEn } from './groups/requirements';
import { settingsFr, settingsEn } from './groups/settings';
import { votingFr, votingEn } from './groups/voting';
import { workspaceFr, workspaceEn } from './groups/workspace';
import { activityFr, activityEn } from './groups/activity';
import { notepadFr, notepadEn } from './groups/notepad';
import { templatesFr, templatesEn } from './groups/templates';
import { checklistFr, checklistEn } from './groups/checklist';

export const messages = {
  fr: {
    common: commonFr,
    app: appFr,
    nav: navFr,
    home: homeFr,
    account: accountFr,
    assistant: assistantFr,
    auth: authFr,
    dialog: dialogFr,
    ui: uiFr,
    budget: budgetFr,
    candidates: candidatesFr,
    candidateDetail: candidateDetailFr,
    compare: compareFr,
    evaluations: evaluationsFr,
    reminders: remindersFr,
    requirements: requirementsFr,
    settings: settingsFr,
    voting: votingFr,
    workspace: workspaceFr,
    activity: activityFr,
    notepad: notepadFr,
    templates: templatesFr,
    checklist: checklistFr,
  },
  en: {
    common: commonEn,
    app: appEn,
    nav: navEn,
    home: homeEn,
    account: accountEn,
    assistant: assistantEn,
    auth: authEn,
    dialog: dialogEn,
    ui: uiEn,
    budget: budgetEn,
    candidates: candidatesEn,
    candidateDetail: candidateDetailEn,
    compare: compareEn,
    evaluations: evaluationsEn,
    reminders: remindersEn,
    requirements: requirementsEn,
    settings: settingsEn,
    voting: votingEn,
    workspace: workspaceEn,
    activity: activityEn,
    notepad: notepadEn,
    templates: templatesEn,
    checklist: checklistEn,
  },
} as const;

export type Locale = keyof typeof messages;
export type Messages = (typeof messages)['fr'];
