<div align="center">

```
      ✻          ✻            ✻
   \(✻ᴗ✻)/    (✻ᴗ✻)/      (✻ᴗ✻)zZ
```

# claude-mods

**Claude Code 옆구리에 붙이는 작은 창들, 그리고 한국인 맞춤 손질.**
토큰이 어디로 새는지, 서브에이전트가 뭘 하는지, 어느 계정으로 일하는지 대화 옆에서 바로 봅니다.
한영키 깜빡한 프롬프트는 구해 주고, 도구는 두꺼비집처럼 내렸다 올립니다.

| mod | 한 줄 요약 |
|---|---|
| 📊 [token-chart](#-token-chart) | 요청별 토큰과 컨텍스트, 세션 비용 차트 |
| ✻ [agent-lounge](#-agent-lounge) | 서브에이전트가 지금 뭘 하는지 실시간 라운지 |
| ◉ [account-hub](#-account-hub) | Claude, GitHub, git commit 계정 카드 |
| ⛑ [hanyoung-119](#-hanyoung-119-한영키-구조대) | `dkssud` 를 `안녕` 으로 고쳐서 보내는 한영키 구조대 |
| ⚡ [dukkeobi](#-dukkeobi-도구-두꺼비집) | Bash, Edit, 웹, MCP 도구를 끄고 켜는 두꺼비집 |

`Claude Code ≥ 2.1.287` · `terminal` · `desktop` · `vscode` · `MIT`

</div>

---

## 한 줄 설치

Claude Code 프롬프트에서:

```
/plugin install token-chart --marketplace danixaiofficial-wq/claude-mods
/plugin install agent-lounge --marketplace danixaiofficial-wq/claude-mods
/plugin install account-hub --marketplace danixaiofficial-wq/claude-mods
/plugin install hanyoung-119 --marketplace danixaiofficial-wq/claude-mods
/plugin install dukkeobi --marketplace danixaiofficial-wq/claude-mods
```

필요한 것만 골라 설치해도 됩니다. 처음 한 번은 `Add marketplace?`가 뜹니다. `y`로 답하고, 범위는 Enter(user)로 고르면 끝입니다. 설치한 세션에서 바로 동작합니다.

<details>
<summary>셸에서 설치하기 / Desktop 앱에서 설치하기</summary>

셸에서:

```bash
claude plugin install token-chart --marketplace danixaiofficial-wq/claude-mods
claude plugin install agent-lounge --marketplace danixaiofficial-wq/claude-mods
claude plugin install account-hub --marketplace danixaiofficial-wq/claude-mods
claude plugin install hanyoung-119 --marketplace danixaiofficial-wq/claude-mods
claude plugin install dukkeobi --marketplace danixaiofficial-wq/claude-mods
```

Desktop 앱(`/plugin`이 없는 곳): 프롬프트 옆 **+** → **Plugins** → **Add marketplace**에 `danixaiofficial-wq/claude-mods` → **Add plugin**.

</details>

---

## 📊 token-chart

> 이번 요청에 토큰을 얼마나 썼지? 컨텍스트는 얼마나 찼지?

요청 하나가 막대 하나입니다. 막대 전체 길이가 컨텍스트 창이라서, 아래로 내려갈수록 컨텍스트가 차오르는 게 보입니다.

```
╭─ Token usage ─────────────────────────────────╮
│ Session cost $1.84                            │
│ Context 46% (92k / 200k)                      │
│ 12 requests · output total 18k                │
│ ▓ cache read  █ cache write  █ input          │
│ ───────────────────────────────────────────── │
│ #10  ▓▓▓▓▓▓▓▓▓▓▓█··············   84k ↑1.1k  │
│ #11  ▓▓▓▓▓▓▓▓▓▓▓▓██············   88k ↑1.2k  │
│ #12  ▓▓▓▓▓▓▓▓▓▓▓▓▓█············   92k ↑840   │
╰───────────────────────────────────────────────╯
```

| 보이는 것 | 의미 |
|---|---|
| `▓` 회색 | cache read. 싸게 다시 읽은 토큰 |
| `█` 노랑 | cache write. 이번에 캐시에 새로 쓴 토큰 |
| `█` 파랑 | input. 캐시를 안 거친 토큰 |
| `↑840` | 그 요청의 output 토큰 |
| `Session cost` | 세션 누적 비용(USD) |

- 명령: `/token-chart`
- main thread 요청만 기록합니다. 서브에이전트 몫은 👇 agent-lounge에서 봅니다.
- 행 번호는 세션 전체 기준이라 오래된 행이 밀려나도 번호가 바뀌지 않습니다.

---

## ✻ agent-lounge

> 에이전트들 지금 뭐 해? 누가 놀고 누가 일해?

서브에이전트마다 ✻ 캐릭터가 하나씩 붙습니다. 표정이 상태고, 손에 든 소품이 종류입니다.

```
╭─ ✻ Agent Lounge ──────────────────────────────╮
│ ✻ 4 agents · 2 working · 2 resting            │
│ ⌕ Explore          ■■■■■■■■■■■■ 2             │
│ ✎ Plan             ■■■■■■ 1                   │
│ ───────────────────────────────────────────── │
│ (✻ᴗ✻)/   ✎ Plan 인증 구조 설계                │
│          ▸ Read auth.ts · 42s · 7 tools       │
│ \(✻ᴗ✻)   ✓ code-reviewer review helpers       │
│          ▸ Grep "token" · 18s · 3 tools       │
│ \(✻ᴗ✻)/  ⌕ Explore find auth code             │
│          done 12s · 4 tools · ctx 18k · ...   │
╰───────────────────────────────────────────────╯
```

### 표정 = 상태

| 캐릭터 | 상태 |
|---|---|
| `(✻ᴗ✻)/` `(✻ᴗ✻)-` `\(✻ᴗ✻)` | 일하는 중. 도구를 쓸 때마다 손을 흔듭니다 |
| `\(✻ᴗ✻)/` | 끝! 만세 |
| `(✻x✻);` | 실패 |
| `(✻-✻)z` | 중단됨 |
| `(✻ᴗ✻)zZ` | 아무도 없음. 라운지에서 낮잠 중 |

### 소품 = 에이전트 종류

| 소품 | 종류 |
|:-:|---|
| `⌕` | Explore, search |
| `✎` | Plan, architect |
| `✓` | *-reviewer |
| `⚗` | test, tdd |
| `⚒` | build, resolver |
| `¶` | doc |
| `✦` | 그 밖의 모든 에이전트 |

- 명령: `/agent-lounge` (창 열기), `/agent-lounge status` (기록을 글로 보기)
- 일하는 에이전트가 위로 올라오고, 캐릭터와 경과 시간이 1초마다 움직입니다. 다 쉬면 타이머도 같이 쉽니다.
- 일하는 중에는 `▸ Read auth.ts`, `▸ $ npm test`, `▸ Fetch docs.github.com`처럼 지금 하는 일을 보여 줍니다.
- 끝나면 도구 호출 수, 컨텍스트 크기, output 토큰을 남깁니다.
- 기록은 50개까지 남기고, 넘치면 끝난 에이전트부터 정리합니다. 일하는 중인 에이전트는 밀려나지 않습니다.

---

## ◉ account-hub

> 지금 어느 계정으로 로그인했지? commit은 어떤 이메일로 남지?

```
╭─ ◉ Accounts ───────────────────────── checked 09:07 ╮
│ ╭ ✻ Claude ────────────────────────────────────────╮ │
│ │ Kim  kim@example.com                             │ │
│ │ admin · Pro/Max 구독                             │ │
│ ╰──────────────────────────────────────────────────╯ │
│ ╭ ◆ GitHub ────────────────────────────────────────╮ │
│ │ @kimdev  (gh 로그인)                             │ │
│ ╰──────────────────────────────────────────────────╯ │
│ ╭ ◇ git commit 작성자 ─────────────────────────────╮ │
│ │ global  kim <kim@company.example>                │ │
│ │ repo    (global 따름)                            │ │
│ ╰──────────────────────────────────────────────────╯ │
│ ⚠ 이 폴더의 commit은 전역 이메일로 남아요            │
╰──────────────────────────────────────────────────────╯
```

- 명령: `/account-hub` (열 때마다 새로 확인합니다)
- 회사 계정과 개인 계정을 오가는 사람에게 좋습니다. 개인 repo에 회사 이메일로 commit하기 전에 경고합니다.
- Claude 계정은 `~/.claude.json`의 `oauthAccount`에서 이름, 이메일, 조직, 역할, 요금제 표시 필드만 읽습니다. **token은 읽지도 저장하지도 않습니다.**

---

## ⛑ hanyoung-119 (한영키 구조대)

> 아 또 영어로 쳤네… `rmfjgrp gownj`

한영키를 깜빡하고 친 프롬프트를 Claude에게 보내기 전에 한글로 고칩니다.

```
입력   dkssudgktpdy            보냄   안녕하세요
입력   이거 rmfjgrp 해줘       보냄   이거 그렇게 해줘
입력   git push 해줘           보냄   git push 해줘   (영어는 그대로)

⛑ 한영키 구조대 출동! rmfjgrp → 그렇게 (누적 12건)
```

- 명령: `/hanyoung` (상태), `/hanyoung on` / `off`, `/hanyoung dkssud` (바꾸지 않고 미리보기)
- 바꿀 때는 원문을 Claude에게 함께 넘깁니다. 혹시 잘못 바뀌어도 Claude가 원문을 보고 알아듣습니다.
- 영어를 잘못 바꾸지 않게 여러 겹으로 막습니다.
  - 자주 쓰는 영어 단어 예외 목록이 있습니다.
  - 한글 옆에서는 4글자 이상인 단어만 바꿉니다.
  - 영어 모음(a, e, i, o, u) 비율이 높은 단어는 영어로 봅니다.
  - 백틱 코드, URL, `/` 명령, `!` 명령은 건드리지 않습니다.

---

## ⚡ dukkeobi (도구 두꺼비집)

> 이번 작업은 읽기만 해. 인터넷은 쓰지 마.

Claude가 쓰는 도구를 차단기처럼 내리고 올립니다. 내린 도구는 Claude가 불러도 실행 전에 막힙니다.

```
╭─ ⚡ 도구 두꺼비집 ──────────────────────────────────────────────╮
│ ⚡ 두꺼비집 ● 켜짐 38  ·  ○ 내림 3                               │
│ 1: 전부 켜기   2: 읽기 전용   3: 인터넷 차단   4: MCP 차단        │
│ ─────────────────────────────────────────────────────────────── │
│ 파일                                                            │
│ ● Read 파일 읽기    ○ E̶d̶i̶t̶ 파일 수정    ● Grep 내용 검색          │
│ 실행                                                            │
│ ○ B̶a̶s̶h̶ 셸 명령      ● Monitor 프로세스 감시                       │
│ MCP 서버                                                        │
│ ● claude.ai Gmail 25개    ○ c̶l̶a̶u̶d̶e̶.̶a̶i̶ ̶F̶i̶g̶m̶a̶ 30개                 │
╰─────────────────────────────────────────────────────────────────╯
```

- 명령: `/dukkeobi` (창 열기), `/dukkeobi off bash`, `/dukkeobi on bash`, `/dukkeobi status`
- 프리셋: `/dukkeobi all`, `readonly`, `offline`, `nomcp`. 창에서는 숫자 1-4입니다.
- 창을 잡으면(ctrl+x tab 또는 클릭) Tab으로 고르고 Enter로 켜고 끕니다.
- MCP 도구는 서버 단위로 묶습니다. Gmail 도구가 25개여도 스위치는 하나입니다.
- 서브에이전트의 도구 호출도 막습니다. 막힌 Claude에게는 "켜 달라고 요청하라"는 안내가 갑니다.
- 설정은 다음 세션에도 남고, 내린 차단기가 있으면 상태 줄에 `⚡ 도구 3개 내림`이 보입니다.

---

## 💡 창이 안 보여요

세션을 시작할 때 저절로 열리는 창은 터미널 폭이 **144칸 이상**일 때만 자리를 잡습니다. 좁으면 조용히 대기하니 명령으로 직접 여세요.

```
/token-chart
/agent-lounge
/account-hub
/dukkeobi
```

agent-lounge는 대기 상태가 되면 `(✻ᴗ✻) Agent Lounge는 /agent-lounge 로 열 수 있어요` toast로 알려 줍니다.

---

## 🔒 무엇에 접근하나요

mod는 내 권한으로 Claude Code 안에서 실행되는 코드입니다. 이 저장소의 mod가 요청하는 작업은 이게 전부입니다.

| mod | 쓰는 API |
|---|---|
| token-chart | 명령 등록, 창 열기/그리기, 세션 상태 저장, 로그 |
| agent-lounge | 위의 것 + 에이전트 목록 조회, 시계(1초 타이머), toast |
| account-hub | 창 + **파일 읽기**(`~/.claude.json`의 계정 표시 필드만), **프로세스 실행**(`gh config get`, `git config`, `git rev-parse`), 환경 변수 `HOME`, `CLAUDE_CONFIG_DIR` 읽기 |
| hanyoung-119 | 프롬프트 다시 쓰기(영문 자판 한글만), 설정 저장(`$.store`), toast |
| dukkeobi | 도구 목록 조회, **도구 호출 거절**(내린 것만), 설정 저장(`$.store`), 상태 줄, 창 |

어느 mod도 파일을 쓰거나 네트워크 요청을 보내지 않습니다. 파일을 읽고 프로세스를 실행하는 건 account-hub뿐이고, 위에 적은 것만 합니다. 설치 전에 직접 확인하려면:

```bash
git clone https://github.com/danixaiofficial-wq/claude-mods
claude plugin validate claude-mods/account-hub   # hooks: / calls: / env reads: 줄을 보세요
```

---

## 🛠 직접 고쳐 쓰기

```
claude-mods/
├── .claude-plugin/marketplace.json   # 이 저장소를 marketplace로 만드는 파일
├── token-chart/
│   ├── .claude-plugin/plugin.json
│   ├── hooks/{hooks.json, register.tsx}
│   ├── types/index.d.ts              # $.state 타입 계약
│   └── tests/
├── agent-lounge/
│   ├── hooks/{hooks.json, register.tsx, lounge.ts}
│   ├── types/index.d.ts
│   └── tests/
├── account-hub/                      # hooks/accounts.ts: 계정 파싱, 경고
├── hanyoung-119/                     # hooks/hangul.ts: 두벌식 조합, 영어 판별
└── dukkeobi/                         # hooks/switchboard.ts: 스위치, 프리셋
```

고친 걸 바로 띄워 보기:

```bash
claude --plugin-dir ./agent-lounge          # 한 세션 동안 이 폴더의 mod를 로드
claude plugin validate ./agent-lounge       # 엔진이 거절할 것이 없는지 확인
claude plugin test ./agent-lounge           # tests/*.test.tsx 실행
```

mod가 처음 로드되면 엔진이 `.claude-plugin/types/`에 API 타입을 깔아 줍니다. 그다음부터는 `tsc -p ./agent-lounge`로 type-check가 됩니다.

---

<div align="center">

```
(✻ᴗ✻)/  즐거운 모딩 되세요
```

Made with Claude Code mods · [mods 문서](https://code.claude.com/docs/ko/plugins/mods/overview) · [MIT License](LICENSE)

</div>
