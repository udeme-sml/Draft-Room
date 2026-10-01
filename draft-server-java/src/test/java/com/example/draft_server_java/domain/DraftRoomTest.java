package com.example.draft_server_java.domain;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class DraftRoomTest {
    @Test
    public void testHappyPathJoinAndPick() {
        DraftRoom draftRoom = new DraftRoom(new PlayerPool());
        draftRoom.join("Alice");
        draftRoom.join("Bob");
        draftRoom.startDraft();
        draftRoom.pick("Alice", "lebron james");
        Assertions.assertEquals("Bob", draftRoom.getDraftState().onClock());
        Assertions.assertEquals(2, draftRoom.getDraftState().turnOrder().size());
        Assertions.assertEquals(1, draftRoom.getDraftState().picks().size());
        Assertions.assertEquals("lebron james", draftRoom.getDraftState().picks().get(0).player());
        Assertions.assertEquals("Alice", draftRoom.getDraftState().picks().get(0).by());
    }

    @Test
    public void testConcurrentPicks() throws InterruptedException {
        DraftRoom draftRoom = new DraftRoom(new PlayerPool());
        draftRoom.join("Alice");
        draftRoom.join("Bob");
        draftRoom.startDraft();

        AtomicInteger successCount = new AtomicInteger();
        AtomicInteger failureCount = new AtomicInteger();
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch bothWorkersReady = new CountDownLatch(2);

        Runnable concurrentPick = () -> {
            try {
                bothWorkersReady.countDown();
                startGate.await();
                draftRoom.pick("Alice", "lebron james");
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

        Assertions.assertEquals(1, successCount.get(), "exactly one pick should succeed");
        Assertions.assertEquals(1, failureCount.get(), "the other pick should fail");
        Assertions.assertEquals(1, draftRoom.getDraftState().picks().size());
        Assertions.assertEquals("lebron james", draftRoom.getDraftState().picks().get(0).player());
        Assertions.assertEquals("Alice", draftRoom.getDraftState().picks().get(0).by());
        Assertions.assertEquals("Bob", draftRoom.getDraftState().onClock());
    }
}
