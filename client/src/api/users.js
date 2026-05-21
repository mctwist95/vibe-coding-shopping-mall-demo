const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// 회원가입 요청을 보내고 응답 결과를 반환한다.
export async function createUser(payload) {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const message = result?.message || "회원가입 처리 중 오류가 발생했습니다.";
    throw new Error(message);
  }

  return result;
}
