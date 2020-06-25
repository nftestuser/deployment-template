module.exports.sleep = async function (sleep) {
  return new Promise(resolve => setTimeout(resolve, sleep));
};
