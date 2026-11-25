// 로마자(개정 로마자 표기와 흔한 관용 표기) 한국 이름을 한글로 바꿈. 전체가 읽히지 않으면 null
const SUR: Record<string, string> = { kim: "김", gim: "김", lee: "이", yi: "이", rhee: "이", park: "박", bak: "박", pak: "박", choi: "최", choe: "최", jung: "정", chung: "정", jeong: "정", kang: "강", gang: "강", cho: "조", jo: "조", yoon: "윤", yun: "윤", jang: "장", chang: "장", lim: "임", im: "임", han: "한", oh: "오", o: "오", seo: "서", suh: "서", shin: "신", sin: "신", kwon: "권", gwon: "권", hwang: "황", ahn: "안", an: "안", song: "송", yoo: "유", yu: "유", ryu: "류", hong: "홍", jeon: "전", jun: "전", chun: "천", cheon: "천", ko: "고", go: "고", moon: "문", mun: "문", son: "손", bae: "배", baek: "백", paik: "백", heo: "허", huh: "허", nam: "남", noh: "노", no: "노", roh: "노", ha: "하", kwak: "곽", gwak: "곽", seong: "성", sung: "성", cha: "차", joo: "주", ju: "주", woo: "우", u: "우", min: "민", byeon: "변", byun: "변", na: "나", ra: "라", eom: "엄", um: "엄", eum: "음", ki: "기", gi: "기", gu: "구", koo: "구", ku: "구", yang: "양", do: "도", ma: "마", wang: "왕", hyun: "현", hyeon: "현", tak: "탁", ji: "지", ok: "옥", jin: "진", yeo: "여", in: "인", ri: "리", gye: "계", bu: "부", pyo: "표", seol: "설", sol: "설", maeng: "맹", myung: "명", myeong: "명", chae: "채", cheong: "청", gong: "공", kong: "공", ban: "반", sa: "사", yeom: "염", yum: "염", bang: "방", pyeon: "편", ham: "함", kook: "국", guk: "국", ryeo: "려", hur: "허", shim: "심", sim: "심", choo: "추", chu: "추", jae: "재" };
const ALIAS: [RegExp, string][] = [[/oo/g, "u"], [/hee/g, "hui"], [/ee/g, "i"], [/jung/g, "jeong"], [/sung/g, "seong"], [/chul/g, "cheol"], [/young/g, "yeong"], [/yung/g, "yeong"], [/hyun/g, "hyeon"], [/joon/g, "jun"], [/sook/g, "suk"], [/yoon/g, "yun"], [/shi/g, "si"], [/kyu/g, "gyu"], [/kyung/g, "gyeong"], [/sun(?!g)/g, "seon"], [/eon(?=$)/g, "eon"]];
const INI: [string, number][] = [["kk", 1], ["tt", 4], ["pp", 8], ["ss", 10], ["jj", 13], ["ch", 14], ["g", 0], ["k", 15], ["n", 2], ["d", 3], ["t", 16], ["r", 5], ["l", 5], ["m", 6], ["b", 7], ["p", 17], ["s", 9], ["j", 12], ["h", 18], ["", 11]];
const VOW: [string, number][] = [["yi", 20], ["yae", 3], ["yeo", 6], ["wae", 10], ["ae", 1], ["ya", 2], ["eo", 4], ["ye", 7], ["wa", 9], ["oe", 11], ["yo", 12], ["wo", 14], ["we", 15], ["wi", 16], ["yu", 17], ["eu", 18], ["ui", 19], ["a", 0], ["e", 5], ["o", 8], ["u", 13], ["i", 20]];
const FIN: [string, number][] = [["ng", 21], ["k", 1], ["g", 1], ["n", 4], ["t", 19], ["l", 8], ["m", 16], ["p", 17], ["b", 17], ["", 0]];
function part(s: string): string | null {
  // 앞에서부터 음절을 읽되, 다음 음절이 읽히는 경우만 받아들임(백트래킹)
  if (!s) return "";
  for (const [i, ii] of INI) {
    if (!s.startsWith(i)) continue;
    const r1 = s.slice(i.length);
    for (const [v, vi] of VOW) {
      if (!r1.startsWith(v)) continue;
      const r2 = r1.slice(v.length);
      for (const [f, fi] of FIN) {
        if (!r2.startsWith(f)) continue;
        const rest = part(r2.slice(f.length));
        if (rest !== null) return String.fromCharCode(0xac00 + (ii * 21 + vi) * 28 + fi) + rest;
      }
    }
  }
  return null;
}
export function rr(name: string): string | null {
  const w = name.trim().toLowerCase().replace(/[^a-z\s-]/g, "").split(/\s+/).filter(Boolean);
  if (w.length < 2 || w.length > 3) return null;
  const sur = SUR[w[0]]; if (!sur) return null;
  let given = "";
  for (const raw of w.slice(1).join("-").split("-")) {
    let p = raw.replace(/^k(?!k)/, "g"); for (const [re, to] of ALIAS) p = p.replace(re, to);
    const h = part(p); if (h === null || !h) return null; given += h;
  }
  if (given.length < 1 || given.length > 3) return null;
  return sur + given;
}
