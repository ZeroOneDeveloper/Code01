import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createClient } from "@lib/supabase/server";

import runCTestCases from "@runner/runCode";
import { isNumericalString } from "motion-utils";

export async function POST(req: NextRequest) {
  const { problemId, code } = (await req.json()) as {
    problemId?: string;
    code?: string;
  };

  if (!problemId)
    return NextResponse.json(
      { error: "problemId is required" },
      { status: 400 },
    );

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { user } = (await supabase.auth.getUser()).data;

  if (!user || !user.id) {
    return NextResponse.json(
      { error: "User not authenticated" },
      { status: 401 },
    );
  }

  const problem = (
    await supabase
      .from("problems")
      .select("time_limit, memory_limit")
      .eq("id", problemId)
      .single()
  ).data;

  const { data } = await supabase
    .from("problem_submissions")
    .insert({
      user_id: user.id,
      problem_id: problemId,
      status_code: 0,
      code,
      stdout_list: [],
      stderr_list: [],
      passed_all: false,
      is_correct: false,
      passed_time_limit: false,
      passed_memory_limit: false,
    })
    .select();

  const submissionId = data?.[0]?.id;

  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  const timeLimit = problem.time_limit;
  const memoryLimit = problem.memory_limit;

  const testCases = (
    await supabase
      .from("test_cases")
      .select("input, output")
      .eq(
        "problem_id",
        isNumericalString(problemId) ? parseInt(problemId, 10) : problemId,
      )
  ).data;

  const inputs = testCases?.map((tc) => tc.input) || [];
  const outputs = testCases?.map((tc) => tc.output) || [];

  try {
    const result = await runCTestCases(
      code,
      inputs,
      outputs,
      timeLimit,
      memoryLimit,
    );
    let statusCode = 1;
    if (!result.is_correct) {
      statusCode = 2; // Wrong Answer
    } else if (!result.passed_time_limit) {
      statusCode = 3; // Time Limit Exceeded
    } else if (!result.passed_memory_limit) {
      statusCode = 4; // Memory Limit Exceeded
    }
    await supabase
      .from("problem_submissions")
      .update({
        status_code: statusCode,
        stdout_list: result.results.map((r) => r.stdout),
        stderr_list: result.results.map((r) => r.stderr),
        passed_all:
          result.is_correct &&
          result.passed_time_limit &&
          result.passed_memory_limit,
        is_correct: result.is_correct,
        passed_time_limit: result.passed_time_limit,
        passed_memory_limit: result.passed_memory_limit,
      })
      .eq("id", submissionId);
    return NextResponse.json(
      { message: "Test cases executed successfully", submissionId },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error running test cases:", error.message);
      await supabase
        .from("problem_submissions")
        .update({
          status_code: 5, // Runtime Error
          stdout_list: [],
          stderr_list: [error.message],
          passed_all: false,
          is_correct: false,
          passed_time_limit: false,
          passed_memory_limit: false,
        })
        .eq("id", submissionId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "An unknown error occurred" },
      { status: 500 },
    );
  }
}
