pragma solidity 0.5.8;


contract DelegateProxy {
  function () external payable { }
  function delegate(address to, bytes memory data) public {
    (bool success, ) = to.delegatecall(data);
    require(success, "Delegate call failed.");
  }
}
