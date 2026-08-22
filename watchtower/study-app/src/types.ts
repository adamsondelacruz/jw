export type StudyFileKind = "markdown" | "html" | "pdf" | "package";

export type StudyFile = {
  id: string;
  kind: StudyFileKind;
  name: string;
  path: string;
};

export type Study = {
  id: string;
  title: string;
  week: string;
  preferredFileId?: string;
  packagePath?: string;
  paragraphsPath?: string;
  sourceArticleFiles?: string[];
  packageData?: StudyPackage;
  files: StudyFile[];
};

export type StudyManifest = {
  studies: Study[];
};

export type AnswerPair = {
  en: string;
  tl: string;
};

export type StudyQuestion = {
  id: string;
  number: string;
  questionEn: string;
  questionTl: string;
  direct: AnswerPair;
  deeper: AnswerPair;
  paragraph?: AnswerPair;
};

export type ParagraphMap = {
  source?: Partial<AnswerPair>;
  questions: Record<
    string,
    {
      question?: Partial<AnswerPair>;
      paragraph?: Partial<AnswerPair>;
    }
  >;
};

export type StudyPackage = {
  schema: "jw-study-package/v1";
  id: string;
  title: string;
  week: string;
  generatedAt?: string;
  source?: Partial<AnswerPair>;
  meta?: string[];
  questions: Array<{
    id?: string;
    number: string;
    question: Partial<AnswerPair>;
    direct: Partial<AnswerPair>;
    deeper: Partial<AnswerPair>;
    paragraph?: Partial<AnswerPair>;
  }>;
};

export type LoadedStudy =
  | {
      kind: "study";
      sourceKind: "markdown" | "html" | "pdf" | "package";
      title: string;
      meta: string[];
      questions: StudyQuestion[];
    }
  | {
      kind: "pdf";
      title: string;
      url: string;
    };
