import mongoose from "mongoose";

function isReplicaSetRequiredError(err) {
  return (
    err?.code === 20 ||
    /replica set/i.test(err?.message || "") ||
    /Transaction numbers are only allowed/i.test(err?.message || "")
  );
}

export async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    if (isReplicaSetRequiredError(err)) {
      return work(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
}
