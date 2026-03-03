
// Mock types
interface Shot {
  description: string;
  duration: number;
  assetRefs: string[];
}

interface ScriptGenerationResult {
  shots: Shot[];
  summary: string;
}

// 1. Mock fallbackParse to test logic
function fallbackParse(response: string): ScriptGenerationResult {
  const shots: any[] = [];
  
  // 尝试按行解析
  const lines = response.split('\n');
  let currentShot: any = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 匹配分镜标题（如 "分镜1:" 或 "1." 或 " Shot 1:"）
    if (/^分镜\s*\d+[:：]|^\d+[.．]\s|^Shot\s*\d+[:：]/i.test(trimmed)) {
      if (currentShot) {
        shots.push(currentShot);
      }
      // Simplified: Just taking the rest of line as description init
      let desc = trimmed.replace(/^分镜\s*\d+[:：]|^\d+[.．]\s|^Shot\s*\d+[:：]\s*/i, '');
      currentShot = {
        description: desc,
        duration: 5,
        assetRefs: []
      };
    } else if (currentShot && trimmed) {
      // 累积描述 - THE LOGIC UNDER TEST
      if (!currentShot.description.includes(trimmed)) {
        currentShot.description += ' ' + trimmed;
      }
    }
  }
  
  if (currentShot) {
    shots.push(currentShot);
  }

  // 如果没有解析到任何分镜，创建一个默认分镜
  if (shots.length === 0) {
    shots.push({
      description: '剧本场景：' + response.substring(0, 100) + '...',
      duration: 5,
      assetRefs: []
    });
  }

  return {
    shots,
    summary: `解析到 ${shots.length} 个分镜（备用解析）`
  };
}

// 2. Mock parseShotsFromResponse to test regex
function parseShotsFromResponse(response: string): ScriptGenerationResult | null {
    try {
      // 尝试提取 JSON - THE LOGIC UNDER TEST
      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) ||
                       response.match(/```\s*([\s\S]*?)```/) ||
                       response.match(/{[\s\S]*}/);
      
      let jsonStr = '';
      if (jsonMatch) {
        // match[1] if capturing group exists (first two), else match[0] (third one)
        jsonStr = jsonMatch[1] || jsonMatch[0];
      } else {
        jsonStr = response;
      }

      // 清理 JSON 字符串
      jsonStr = jsonStr.trim();
      
      console.log(`[parseShotsFromResponse] Extracted JSON string: >>>${jsonStr}<<<`);

      const data = JSON.parse(jsonStr);
      return { shots: data.shots || [], summary: "Parsed JSON" };
    } catch (error) {
      console.log(`[parseShotsFromResponse] JSON Parse Error: ${(error as Error).message}`);
      return null;
    }
}

// --- Test Cases ---

console.log('--- Test 1: fallbackParse Logic ---\n');

const testCases = [
  {
    name: "Duplicate whole sentence",
    input: `1. The sun sets.
The sun sets.`
  },
  {
    name: "Partial overlap (suffix)",
    input: `1. The sun sets.
The sun sets slowly.`
  },
  {
    name: "Partial overlap (prefix)",
    input: `1. He looks at the
the sky.`
  },
  {
    name: "Word duplication issue",
    input: `1. Overview
Overview of the city.`
  }
];

testCases.forEach(tc => {
  console.log(`Case: ${tc.name}`);
  const result = fallbackParse(tc.input);
  console.log(`Input:\n${tc.input}`);
  console.log(`Result Description: "${result.shots[0]?.description}"`);
  console.log('-----------------------------------');
});

console.log('\n--- Test 2: parseShotsFromResponse Regex ---\n');

const regexCases = [
    {
        name: "Standard JSON",
        input: `{"shots": []}`
    },
    {
        name: "JSON with text after (Greedy match failure)",
        input: `Here is the JSON: {"shots": []} and here is some text.`
    },
    {
        name: "JSON with braces in text after",
        input: `{"shots": []}. Hope that helps {user}.`
    }
];

regexCases.forEach(tc => {
    console.log(`Case: ${tc.name}`);
    parseShotsFromResponse(tc.input);
    console.log('-----------------------------------');
});
