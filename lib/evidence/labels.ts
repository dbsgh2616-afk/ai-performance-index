// 변경 이력과 증적자료에서 같은 한국어 이름을 쓰기 위한 표
export const FIELD_LABELS: Record<string, string> = {
  call_count: "호출횟수",
  source: "출처",
  incident: "보안사고",
  saved_minutes: "업무절감시간(분)",
  contribution_pct: "업무기여도(%)",
  correction_factor: "보정계수",
  evidence_grade: "근거 등급",
  respondent_count: "응답자 수",
  target_count: "대상 인원",
  survey_start: "조사 시작일",
  survey_end: "조사 종료일",
  aggregation: "집계 방식",
  question_text: "설문 문항",
  login_id: "아이디",
  name: "이름",
  role: "권한",
  password: "비밀번호",
  gpu_usage_pct: "GPU 사용률(%)",
  memory_usage_pct: "메모리 사용률(%)",
  storage_usage_pct: "스토리지 사용률(%)",
  uptime_pct: "서비스 가동률(%)",
  value: "값",
};

export const TARGET_LABELS: Record<string, string> = {
  monthly_input: "월 입력(호출횟수)",
  monthly_security: "보안사고",
  survey_setting: "설문 설정값",
  account: "계정",
  infra_metric: "AI 인프라 지표",
  roi_input: "인프라 비용·단가",
};

export const UNVERIFIED = "근거 미확인";

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function targetLabel(target: string): string {
  return TARGET_LABELS[target] ?? target;
}
