export interface ChatCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  suggestedQuestions: string[];
}

export const chatCategories: ChatCategory[] = [
  {
    id: 'value',
    name: '가치 발굴러',
    emoji: '💎',
    description: '저평가 종목 찾기, 사이클 투자, 장기 가치투자',
    color: '#22c55e',
    suggestedQuestions: [
      '지금 사이클 바닥에 있는 업종이 있을까?',
      'PBR 1배 이하인데 투자해도 괜찮은 기준이 뭐야?',
      '시멘트나 조선 같은 경기순환주는 언제 사야 해?',
      '저평가 종목을 찾을 때 가장 먼저 봐야 할 지표는?',
      '좋은 가치주의 조건을 알려줘',
    ],
  },
  {
    id: 'chart',
    name: '차트 도우미',
    emoji: '📈',
    description: '추세 분석, 매매 타이밍, 기술적 지표 해석',
    color: '#a855f7',
    suggestedQuestions: [
      '추세 전환을 확인하는 가장 확실한 방법은?',
      '골든크로스가 나왔는데 믿어도 될까?',
      'RSI가 30 아래로 내려갔어. 매수 신호야?',
      '볼린저 밴드 스퀴즈가 뭐야?',
      '손절 라인은 어떻게 잡아야 해?',
    ],
  },
  {
    id: 'financial',
    name: '재무 해석기',
    emoji: '🔢',
    description: '재무제표 읽기, 위험 신호 탐지, 분식회계 감별',
    color: '#3b82f6',
    suggestedQuestions: [
      '재무제표에서 가장 먼저 봐야 할 항목이 뭐야?',
      '영업이익은 흑자인데 순이익이 적자야. 왜 그런 거야?',
      '부채비율이 높으면 무조건 위험한 거야?',
      '현금흐름표는 왜 봐야 하는 거야?',
      '분식회계를 의심해야 하는 신호가 있어?',
    ],
  },
  {
    id: 'timing',
    name: '시장 나침반',
    emoji: '🧭',
    description: '거시경제, 계절성, 금리 사이클, 시장 타이밍',
    color: '#f59e0b',
    suggestedQuestions: [
      '지금 시장에 들어가도 괜찮은 시점이야?',
      '금리가 내려가면 어떤 주식이 좋아져?',
      '올해는 주식하기 좋은 해야?',
      '5월에는 정말 팔아야 해?',
      '폭락장이 오면 어떻게 대응해야 해?',
    ],
  },
  {
    id: 'mindset',
    name: '멘탈 코치',
    emoji: '🧠',
    description: '투자 심리, 손절 원칙, 자금 관리, 습관 교정',
    color: '#06b6d4',
    suggestedQuestions: [
      '손절을 못 하겠어. 어떻게 해야 해?',
      '물타기 해도 돼?',
      '하루에 계좌를 몇 번씩 확인하게 돼. 어떡하지?',
      '종목 수는 몇 개가 적당해?',
      '투자에서 제일 중요한 한 가지가 뭐야?',
    ],
  },
];

export function getCategoryById(id: string): ChatCategory | undefined {
  return chatCategories.find(c => c.id === id);
}
