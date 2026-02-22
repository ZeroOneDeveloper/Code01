import random
from typing import Callable

from sqlalchemy import select

from db.models import TestCase
from db.session import SessionLocal


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


def validate_generate_function(
    generate_func: Callable[[int], tuple[str, str]], seed: int
) -> None:
    try:
        result = generate_func(seed)
    except Exception as exc:
        raise RuntimeError(f"generate({seed}) 실행 중 오류 발생: {exc}") from exc

    if not isinstance(result, tuple) or len(result) != 2:
        raise ValueError("generate(seed)는 (input_text, output_text) 튜플을 반환해야 합니다.")

    input_text, output_text = result
    if not isinstance(input_text, str) or not isinstance(output_text, str):
        raise ValueError("generate(seed)가 반환하는 input/output은 문자열이어야 합니다.")


async def generate_unique_cases(
    generate_func: Callable[[int], tuple[str, str]],
    problem_id: int,
    count: int,
    base_seed: int = 0,
) -> list[dict]:
    """
    generate(seed) -> (input_text, output_text) 형태의 함수를 반복 호출하여
    DB에 이미 존재하는 (input, output)을 제외한 고유 테스트 케이스를 count 개수만큼 생성합니다.
    """
    results: list[dict] = []

    async with SessionLocal() as db:
        try:
            existing_rows = await db.execute(
                select(TestCase.input, TestCase.output).where(
                    TestCase.problem_id == problem_id
                )
            )
        except Exception as exc:
            raise RuntimeError(f"DB 조회 중 오류 발생: {exc}") from exc

        existing = set(
            (row.input.strip(), row.output.strip())
            for row in existing_rows.all()
            if row.input is not None and row.output is not None
        )

        seed = base_seed
        while len(results) < count:
            try:
                input_text, output_text = generate_func(seed)
            except Exception as exc:
                raise RuntimeError(f"generate({seed}) 실행 중 오류 발생: {exc}") from exc

            pair = (input_text.strip(), output_text.strip())
            if pair not in existing:
                existing.add(pair)
                results.append({"input": input_text, "output": output_text})

            seed += 1

            if seed - base_seed > count * 100:
                raise RuntimeError(
                    "너무 많은 중복이 발생하여 충분한 케이스를 생성하지 못했습니다."
                )

        for case in results:
            db.add(
                TestCase(
                    problem_id=problem_id,
                    input=case["input"],
                    output=case["output"],
                )
            )

        await db.commit()

    return results
