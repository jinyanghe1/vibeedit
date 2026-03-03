// 1. Mock fallbackParse to test logic
function fallbackParse(response) {
    var shots = [];
    // 尝试按行解析
    var lines = response.split('\n');
    var currentShot = null;
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        var trimmed = line.trim();
        // 匹配分镜标题（如 "分镜1:" 或 "1." 或 " Shot 1:"）
        if (/^分镜\s*\d+[:：]|^\d+[.．]\s|^Shot\s*\d+[:：]/i.test(trimmed)) {
            if (currentShot) {
                shots.push(currentShot);
            }
            // Simplified: Just taking the rest of line as description init
            var desc = trimmed.replace(/^分镜\s*\d+[:：]|^\d+[.．]\s|^Shot\s*\d+[:：]\s*/i, '');
            currentShot = {
                description: desc,
                duration: 5,
                assetRefs: []
            };
        }
        else if (currentShot && trimmed) {
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
        shots: shots,
        summary: "\u89E3\u6790\u5230 ".concat(shots.length, " \u4E2A\u5206\u955C\uFF08\u5907\u7528\u89E3\u6790\uFF09")
    };
}
// 2. Mock parseShotsFromResponse to test regex
function parseShotsFromResponse(response) {
    try {
        // 尝试提取 JSON - THE LOGIC UNDER TEST
        var jsonMatch = response.match(/```json\s*([\s\S]*?)```/) ||
            response.match(/```\s*([\s\S]*?)```/) ||
            response.match(/{[\s\S]*}/);
        var jsonStr = '';
        if (jsonMatch) {
            // match[1] if capturing group exists (first two), else match[0] (third one)
            jsonStr = jsonMatch[1] || jsonMatch[0];
        }
        else {
            jsonStr = response;
        }
        // 清理 JSON 字符串
        jsonStr = jsonStr.trim();
        console.log("[parseShotsFromResponse] Extracted JSON string: >>>".concat(jsonStr, "<<<"));
        var data = JSON.parse(jsonStr);
        return { shots: data.shots || [], summary: "Parsed JSON" };
    }
    catch (error) {
        console.log("[parseShotsFromResponse] JSON Parse Error: ".concat(error.message));
        return null;
    }
}
// --- Test Cases ---
console.log('--- Test 1: fallbackParse Logic ---\n');
var testCases = [
    {
        name: "Duplicate whole sentence",
        input: "1. The sun sets.\nThe sun sets."
    },
    {
        name: "Partial overlap (suffix)",
        input: "1. The sun sets.\nThe sun sets slowly."
    },
    {
        name: "Partial overlap (prefix)",
        input: "1. He looks at the\nthe sky."
    },
    {
        name: "Word duplication issue",
        input: "1. Overview\nOverview of the city."
    }
];
testCases.forEach(function (tc) {
    var _a;
    console.log("Case: ".concat(tc.name));
    var result = fallbackParse(tc.input);
    console.log("Input:\n".concat(tc.input));
    console.log("Result Description: \"".concat((_a = result.shots[0]) === null || _a === void 0 ? void 0 : _a.description, "\""));
    console.log('-----------------------------------');
});
console.log('\n--- Test 2: parseShotsFromResponse Regex ---\n');
var regexCases = [
    {
        name: "Standard JSON",
        input: "{\"shots\": []}"
    },
    {
        name: "JSON with text after (Greedy match failure)",
        input: "Here is the JSON: {\"shots\": []} and here is some text."
    },
    {
        name: "JSON with braces in text after",
        input: "{\"shots\": []}. Hope that helps {user}."
    }
];
regexCases.forEach(function (tc) {
    console.log("Case: ".concat(tc.name));
    parseShotsFromResponse(tc.input);
    console.log('-----------------------------------');
});
