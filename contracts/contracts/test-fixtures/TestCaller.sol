pragma solidity 0.5.9;

import "../libs/LibStaticCall.sol";


contract TestCaller {

  using LibStaticCall for address;

  function execStaticCall(
    address to,
    bytes4 selector,
    bytes memory params
  )
    public
    view
    returns (bytes memory)
  {
    bytes memory data = abi.encodePacked(selector, params);
    return to.staticcall_as_bytes(data);
  }

}
