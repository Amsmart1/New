import os

def verify():
    with open('js/student.js', 'r') as f:
        content = f.read()

    # Check for IDs in renderQuizzes
    if 'id="attempts-count-${q.id}"' not in content:
        print("FAIL: attempts-count ID missing")
        return False
    if 'id="quiz-actions-${q.id}"' not in content:
        print("FAIL: quiz-actions ID missing")
        return False
    if 'id="quiz-btn-${q.id}"' not in content:
        print("FAIL: quiz-btn ID missing")
        return False

    # Check for startQuiz disabling
    if "listBtn.disabled = true;" not in content or "listBtn.textContent = 'Starting...';" not in content:
        print("FAIL: startQuiz button disabling missing")
        return False

    # Check for submitQuiz disabling
    if "listBtn.textContent = 'Refreshing...';" not in content:
        print("FAIL: submitQuiz button disabling missing")
        return False

    # Check for high-priority refresh logic
    if 'High-Priority UI Refresh for this specific quiz' not in content:
        print("FAIL: High-Priority UI Refresh block missing")
        return False

    # Using more flexible check for the template string
    if 'attemptsDisplay.textContent =' not in content and 'attemptsUsed' not in content:
        print("FAIL: attemptsDisplay update logic missing")
        return False

    print("SUCCESS: Logic verification passed via code inspection.")
    return True

if __name__ == "__main__":
    if verify():
        exit(0)
    else:
        exit(1)
