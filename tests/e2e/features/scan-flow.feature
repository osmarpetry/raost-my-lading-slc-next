Feature: Live scan flow
  Scenario: Valid URL starts a scan and shows progress
    Given the live scan page is open
    When I submit "https://example.com"
    Then I should see scan progress in the terminal

  Scenario: Invalid URL text is blocked before the request is sent
    Given the live scan page is open
    When I submit "not-a-url"
    Then I should see a client-side validation error

  Scenario: Mobile submit focuses the terminal
    Given the live scan page is open
    And I switch to a mobile viewport
    When I submit "https://example.com"
    Then the terminal should receive focus on mobile

  Scenario: Refresh restores progress during a run
    Given the live scan page is open
    When I submit "https://example.com"
    And I refresh while the scan is running
    Then the scan should still recover and complete

  Scenario: Final verdict appears after completion
    Given the live scan page is open
    When I submit "https://example.com"
    Then I should eventually see the final verdict
    And the scan controls should be re-enabled after completion

  Scenario: Reset clears the active client session
    Given the live scan page is open
    When I submit "https://example.com"
    And I wait for the scan to complete
    And I reset the scan
    Then the scan UI should return to idle
    And the terminal should be reset to the initial session

  Scenario: No auth or billing UI is visible
    Given the live scan page is open
    Then no auth or billing controls should be visible
