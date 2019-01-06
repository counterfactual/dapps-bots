import React, { Component } from 'react';
import { ReactComponent as Logo } from './assets/images/logo.svg';
import { Link } from "react-router-dom";

class Welcome extends Component {
  render() {
    return (
      <Link to="/wager" className="welcome">
        <h1 className="welcome__logo">
          <Logo />
        </h1>
      </Link>
    );
  }
}

export default Welcome;
