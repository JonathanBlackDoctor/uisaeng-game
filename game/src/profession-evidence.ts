// Official source summaries. Timing exceptions and game assumptions are documented separately.
const specialist = {
  url: 'https://law.go.kr/LSW/lsLinkCommonInfo.do?lspttninfSeq=61760',
  sha256: 'db5a1cac4677ee17afc7bea48ca9213ff395e6d77ec286ba91b79c178aa50dad',
};
const nursing = {
  url: 'https://www.law.go.kr/lsLinkCommonInfo.do?lspttninfSeq=195121',
  sha256: 'c7bde3cdeb8fc137f0bb1b276f16c33c6a38b893ec1c5e856df173855458581a',
};
export const PROFESSION_EVIDENCE = {
  dentistry: { text: '치과 전문의 수련은 원칙적으로 인턴 1년과 레지던트 3년이며, 통합치의학과는 인턴 없이 3년입니다.', ...specialist },
  'korean-medicine': { text: '한의사 전문의 수련은 원칙적으로 일반수련의 1년과 전문수련의 3년입니다.', ...specialist },
  nursing: { text: '전문간호사 13개 분야의 국내 교육과정은 교육 전 10년 이내 해당 분야 실무 3년 이상을 요구하며, 교육기간은 2년 이상입니다.', ...nursing },
} as const;
export const PROFESSION_LICENSE_EVIDENCE = {
  dentistry: {
    text: '치과의사 면허는 법정 학력 요건을 갖추고 국가시험에 합격한 뒤 발급받습니다.',
    url: 'https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1032850727',
    sha256: 'ea7b77b555bbb31e7ba8baa2c84128b2ee92ae91ec2f3abd3216c41c186e258a',
  },
  'korean-medicine': {
    text: '한의사 면허는 법정 학력 요건을 갖추고 국가시험에 합격한 뒤 발급받습니다.',
    url: 'https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1032850727',
    sha256: 'ea7b77b555bbb31e7ba8baa2c84128b2ee92ae91ec2f3abd3216c41c186e258a',
  },
  nursing: {
    text: '간호사 면허는 법정 학력 요건을 갖추고 국가시험에 합격한 뒤 발급받습니다.',
    url: 'https://www.law.go.kr/LSW/lsLinkProc.do?chrClsCd=010202&joLnkStr=%EB%B2%95%20%EC%A0%9C4%EC%A1%B0&lsNm=%EA%B0%84%ED%98%B8%EB%B2%95&mode=10',
    sha256: '53b97b24e57d09c0859166778585ec210222fd14dabdbb3b38c3e8416d5e71be',
  },
} as const;
