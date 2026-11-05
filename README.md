<div align="center">

```
      ✻          ✻            ✻
   \(✻ᴗ✻)/    (✻ᴗ✻)/      (✻ᴗ✻)zZ
```

# claude-mods

**Claude Code 옆구리에 붙이는 작은 창들.**
토큰이 어디로 새는지, 서브에이전트가 지금 뭘 하는지, 대화 옆에서 바로 봅니다.

`Claude Code ≥ 2.1.287` · `terminal` · `desktop` · `vscode`

</div>

---

## 한 줄 설치

Claude Code 프롬프트에서:

```
/plugin install token-chart --marketplace danixaiofficial-wq/claude-mods
/plugin install agent-lounge --marketplace danixaiofficial-wq/claude-mods
```

처음 한 번은 `Add marketplace?`가 뜹니다. `y`로 답하고, 범위는 Enter(user)로 고르면 끝입니다. 설치한 세션에서 바로 동작합니다.

<details>
<summary>셸에서 설치하기 / Desktop 앱에서 설치하기</summary>

셸에서:

```bash
claude plugin install token-chart --marketplace danixaiofficial-wq/claude-mods
claude plugin install agent-lounge --marketplace danixaiofficial-wq/claude-mods
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
│          working 42s · 7 tools (Read) · ...   │
│ \(✻ᴗ✻)   ✓ code-reviewer review helpers       │
│          working 18s · 3 tools (Grep) · ...   │
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

- 명령: `/agent-lounge`
- 일하는 에이전트가 위로 올라오고, 경과 시간은 1초마다 갱신됩니다. 다 쉬면 타이머도 같이 쉽니다.
- 에이전트별로 도구 호출 수, 마지막 도구, 컨텍스트 크기, output 토큰을 셉니다.
- 기록은 50개까지 남기고, 넘치면 끝난 에이전트부터 정리합니다. 일하는 중인 에이전트는 밀려나지 않습니다.

---

## 💡 창이 안 보여요

세션을 시작할 때 저절로 열리는 창은 터미널 폭이 **144칸 이상**일 때만 자리를 잡습니다. 좁으면 조용히 대기하니 명령으로 직접 여세요.

```
/token-chart
/agent-lounge
```

agent-lounge는 대기 상태가 되면 `(✻ᴗ✻) Agent Lounge는 /agent-lounge 로 열 수 있어요` toast로 알려 줍니다.

---

## 🔒 무엇에 접근하나요

mod는 내 권한으로 Claude Code 안에서 실행되는 코드입니다. 이 저장소의 mod가 요청하는 작업은 이게 전부입니다.

| mod | 쓰는 API |
|---|---|
| token-chart | 명령 등록, 창 열기/그리기, 세션 상태 저장, 로그 |
| agent-lounge | 위의 것 + 에이전트 목록 조회, 시계(1초 타이머), toast |

파일 읽기/쓰기, 프로세스 실행, 네트워크 요청은 **하지 않습니다**. 설치 전에 직접 확인하려면:

```bash
git clone https://github.com/danixaiofficial-wq/claude-mods
claude plugin validate claude-mods/token-chart   # hooks: / calls: 줄을 보세요
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
└── agent-lounge/
    ├── .claude-plugin/plugin.json
    ├── hooks/{hooks.json, register.tsx, lounge.ts}
    ├── types/index.d.ts
    └── tests/
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

Made with Claude Code mods · [mods 문서](https://code.claude.com/docs/ko/plugins/mods/overview)

</div>
