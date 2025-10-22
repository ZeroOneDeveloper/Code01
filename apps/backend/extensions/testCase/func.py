import random
from typing import Callable

from supabase import AsyncClient

# 기존 generate_unique_cases는 삭제 또는 무시, 아래에 새로운 함수 2개 추가


def load_generate_function(
    code: str, seed: int = 0
) -> Callable[[int], tuple[str, str]]:
    """
    문자열 코드에서 generate(seed: int) 함수를 추출하여 리턴합니다.
    """
    random.seed(seed)

    namespace = {"random": random}
    exec(code, namespace)

    generate_func = namespace.get("generate")
    if not callable(generate_func):
        raise ValueError("generate(seed: int) 함수를 정의해야 합니다.")

    return generate_func


async def generate_unique_cases(
    supabase: AsyncClient,
    generate_func: Callable[[int], tuple[str, str]],
    problem_id: int,
    count: int,
    base_seed: int = 0,
) -> list[dict]:
    """
    generate(seed) -> (input_text, output_text) 형태의 함수를 반복 호출하여
    Supabase DB에 이미 존재하는 (input, output)을 제외한 고유 테스트 케이스를 count 개수만큼 생성합니다.
    """
    results: list[dict] = []

    # 기존 데이터 조회 (input, output 모두)
    try:
        test_case = (
            await supabase.table("test_cases")
            .select("input,output")
            .eq("problem_id", problem_id)
            .execute()
        ).data
    except Exception as e:
        raise RuntimeError(f"Supabase 조회 중 오류 발생: {e}")

    existing = set(
        (row["input"].strip(), row["output"].strip()) for row in test_case or []
    )

    seed = base_seed
    while len(results) < count:
        try:
            input_text, output_text = generate_func(seed)
        except Exception as e:
            raise RuntimeError(f"generate({seed}) 실행 중 오류 발생: {e}")

        pair = (input_text.strip(), output_text.strip())
        if pair not in existing:
            existing.add(pair)
            results.append({"input": input_text, "output": output_text})

        seed += 1

        # 무한 루프 방지용 안전 장치
        if seed - base_seed > count * 100:
            raise RuntimeError(
                "너무 많은 중복이 발생하여 충분한 케이스를 생성하지 못했습니다."
            )

    await supabase.table("test_cases").insert(
        [{**case, "problem_id": problem_id} for case in results]
    ).execute()

    return results
