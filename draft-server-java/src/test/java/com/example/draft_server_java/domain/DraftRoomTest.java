package com.example.draft_server_java.domain;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class DraftRoomTest {

    private static DraftRoom newRoom() {
        return new DraftRoom(new PlayerPool());
    }

    private static DraftRoom roomWithAliceAndBob() {
        DraftRoom room = newRoom();
        room.join("Alice");
        room.join("Bob");
        return room;
    }

    private static DraftRoom startedAliceBob() {
        DraftRoom room = roomWithAliceAndBob();
        room.startDraft();
        return room;
    }

    @Test
    void startWithOnePlayerFails() {
        DraftRoom room = newRoom();
        room.join("Alice");

        IllegalStateException ex = Assertions.assertThrows(
            IllegalStateException.class,
            room::startDraft
        );
        Assertions.assertEquals("Not enough players to start draft", ex.getMessage());
    }

    @Test
    void startWithTwoPlayersSucceeds() {
        DraftRoom room = roomWithAliceAndBob();
        room.startDraft();

        DraftState state = room.getDraftState();
        Assertions.assertEquals(2, state.turnOrder().size());
        Assertions.assertEquals("Alice", state.turnOrder().get(0));
        Assertions.assertEquals("Bob", state.turnOrder().get(1));
        Assertions.assertEquals("Alice", state.onClock());
        Assertions.assertTrue(state.picks().isEmpty());
    }

    @Test
    void startTwiceFails() {
        DraftRoom room = startedAliceBob();

        IllegalStateException ex = Assertions.assertThrows(
            IllegalStateException.class,
            room::startDraft
        );
        Assertions.assertEquals("Draft already started", ex.getMessage());
    }

    @Test
    void pickBeforeStartFails() {
        DraftRoom room = roomWithAliceAndBob();

        IllegalStateException ex = Assertions.assertThrows(
            IllegalStateException.class,
            () -> room.pick("Alice", "lebron james")
        );
        Assertions.assertEquals("Draft not started yet", ex.getMessage());
    }

    @Test
    void pickOnWrongTurnFails() {
        DraftRoom room = startedAliceBob();

        IllegalStateException ex = Assertions.assertThrows(
            IllegalStateException.class,
            () -> room.pick("Bob", "lebron james")
        );
        Assertions.assertEquals("It is Alice's turn to pick", ex.getMessage());
    }

    @Test
    void pickWithEmptyNameFails() {
        DraftRoom room = startedAliceBob();

        IllegalArgumentException ex = Assertions.assertThrows(
            IllegalArgumentException.class,
            () -> room.pick("Alice", " ")
        );
        Assertions.assertEquals("Player name cannot be empty", ex.getMessage());
    }

    @Test
    void pickWithInvalidPlayerFails() {
        DraftRoom room = startedAliceBob();

        IllegalArgumentException ex = Assertions.assertThrows(
            IllegalArgumentException.class,
            () -> room.pick("Alice", "fake player")
        );
        Assertions.assertEquals("Player does not exist", ex.getMessage());
    }

    @Test
    void validPickUpdatesTurnAndPicks() {
        DraftRoom room = startedAliceBob();
        room.pick("Alice", "lebron james");

        DraftState state = room.getDraftState();
        Assertions.assertEquals("Bob", state.onClock());
        Assertions.assertEquals(1, state.picks().size());
        Assertions.assertEquals("lebron james", state.picks().get(0).player());
        Assertions.assertEquals("Alice", state.picks().get(0).by());
    }

    @Test
    void playerAlreadyPickedFails() {
        DraftRoom room = startedAliceBob();
        room.pick("Alice", "lebron james");

        IllegalArgumentException ex = Assertions.assertThrows(
            IllegalArgumentException.class,
            () -> room.pick("Bob", "lebron james")
        );
        Assertions.assertEquals("Player already picked by Alice", ex.getMessage());
    }

    @Test
    void pickTurnWraps() {
        DraftRoom room = startedAliceBob();
        room.pick("Alice", "lebron james");
        room.pick("Bob", "stephen curry");

        Assertions.assertEquals("Alice", room.getDraftState().onClock());

        room.pick("Alice", "nikola jokic");

        DraftState state = room.getDraftState();
        Assertions.assertEquals(3, state.picks().size());
        Assertions.assertEquals("nikola jokic", state.picks().get(2).player());
        Assertions.assertEquals("Alice", state.picks().get(2).by());
        Assertions.assertEquals("Bob", state.onClock());
    }

    @Test
    void emptyDraftStateOnStart() {
        DraftRoom room = roomWithAliceAndBob();
        room.startDraft();

        DraftState state = room.getDraftState();
        Assertions.assertEquals(2, state.turnOrder().size());
        Assertions.assertEquals("Alice", state.onClock());
        Assertions.assertEquals(0, state.picks().size());
    }

    @Test
    void draftStateOnPick() {
        DraftRoom room = startedAliceBob();
        room.pick("Alice", "lebron james");

        DraftState state = room.getDraftState();
        Assertions.assertEquals(2, state.turnOrder().size());
        Assertions.assertEquals("Bob", state.onClock());
        Assertions.assertEquals("lebron james", state.picks().get(0).player());
        Assertions.assertEquals("Alice", state.picks().get(0).by());
    }

    @Test
    void joinAfterDraftStartedFails() {
        DraftRoom room = startedAliceBob();

        IllegalStateException ex = Assertions.assertThrows(
            IllegalStateException.class,
            () -> room.join("Charlie")
        );
        Assertions.assertEquals("Draft already started, wait for it to end", ex.getMessage());
    }

    @Test
    void concurrentPicksExactlyOneSucceeds() throws InterruptedException {
        DraftRoom room = startedAliceBob();

        AtomicInteger successCount = new AtomicInteger();
        AtomicInteger failureCount = new AtomicInteger();
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch bothWorkersReady = new CountDownLatch(2);

        Runnable concurrentPick = () -> {
            try {
                bothWorkersReady.countDown();
                startGate.await();
                room.pick("Alice", "lebron james");
                successCount.incrementAndGet();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                Assertions.fail("Worker interrupted waiting to start");
            } catch (RuntimeException e) {
                failureCount.incrementAndGet();
            }
        };

        Thread thread1 = new Thread(concurrentPick);
        Thread thread2 = new Thread(concurrentPick);
        thread1.start();
        thread2.start();

        bothWorkersReady.await();
        startGate.countDown();

        thread1.join();
        thread2.join();

        Assertions.assertEquals(1, successCount.get());
        Assertions.assertEquals(1, failureCount.get());
        Assertions.assertEquals(1, room.getDraftState().picks().size());
        Assertions.assertEquals("Bob", room.getDraftState().onClock());
    }
}
